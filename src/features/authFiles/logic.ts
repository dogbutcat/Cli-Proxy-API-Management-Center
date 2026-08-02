/**
 * 认证文件列表纯逻辑：通配搜索、字段匹配、排序。
 * React-free —— 由 tests/authFilesListLogic.test.ts 直接消费。
 */

import type { AuthFileItem } from '@/types';
import { getAuthFileProviderKey, getAuthFileOperationName } from './constants';
import { deriveAuthFileIdentity } from './identity';
import type { AuthFilesSortMode } from './uiState';

const escapeWildcardSearchSegment = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compareAscii = (left: string, right: string): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

/** 不含 '*' 时返回 null（走 includes 路径）。刻意不加 ^/$ 锚点——保持子串语义。 */
export const buildWildcardSearch = (value: string): RegExp | null => {
  if (!value.includes('*')) return null;
  const pattern = value.split('*').map(escapeWildcardSearchSegment).join('.*');
  return new RegExp(pattern, 'i');
};

/**
 * 搜索 haystack：文件名 + 类型 + 提供方 + 账号邮箱 + 项目 ID。
 * 显式不含 account —— api-key 凭证的 account 就是 API key 本身，见 identity.ts。
 */
export const matchesAuthFileSearch = (
  file: AuthFileItem,
  term: string,
  wildcard: RegExp | null
): boolean => {
  if (!term) return true;
  const needle = term.toLowerCase();
  const identity = deriveAuthFileIdentity(file);
  const providerKey = getAuthFileProviderKey(file);
  const searchableValues =
    providerKey === 'opencode-go'
      ? [providerKey, identity.primary, identity.secondary]
      : [
          file.name,
          file.type,
          file.provider,
          file.email,
          file.projectId,
          identity.primary,
          identity.secondary,
        ];

  return searchableValues.some((value) => {
    const content = (value || '').toString();
    return wildcard ? wildcard.test(content) : content.toLowerCase().includes(needle);
  });
};

/** 返回新数组，不改动入参。未知 mode 原序返回拷贝。 */
export const sortAuthFiles = (files: AuthFileItem[], mode: AuthFilesSortMode): AuthFileItem[] => {
  const copy = [...files];
  if (mode === 'default') {
    copy.sort((a, b) => {
      const providerA = getAuthFileProviderKey(a) || 'unknown';
      const providerB = getAuthFileProviderKey(b) || 'unknown';
      const providerCompare = compareAscii(providerA, providerB);
      if (providerCompare !== 0) return providerCompare;
      return compareAscii(getAuthFileOperationName(a), getAuthFileOperationName(b));
    });
  } else if (mode === 'az') {
    // 按卡片主行排（有账号时即 email），所见即所排；同值用文件名决胜。
    // 装饰一次，避免在比较器里重复派生。
    const keys = new Map(copy.map((file) => [file, deriveAuthFileIdentity(file).primary]));
    copy.sort(
      (a, b) =>
        (keys.get(a) ?? '').localeCompare(keys.get(b) ?? '') ||
        getAuthFileOperationName(a).localeCompare(getAuthFileOperationName(b))
    );
  } else if (mode === 'priority') {
    copy.sort((a, b) => {
      const pa = typeof a.priority === 'number' ? a.priority : 0;
      const pb = typeof b.priority === 'number' ? b.priority : 0;
      return pb - pa; // 高优先级排前面
    });
  }
  return copy;
};
