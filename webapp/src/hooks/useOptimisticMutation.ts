import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { t } from "@i18n/ja";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message || t("E999");
  return t("E999");
}

/**
 * 全mutation共通の楽観的更新パターン(design-browser-ui.md §6.3):
 * onMutateでキャッシュを先に書き換え、onErrorでcontextから復元しつつsonnerのtoastでエラー表示、
 * onSettledで該当queryを再検証する。
 *
 * invalidateKeysはprefixマッチ(TanStack Queryのデフォルト挙動)を利用するため、broadなkey
 * (例: ["entities"])を渡せば配下の全variantが再検証される。SSEによる「該当queryだけ無効化」の
 * 精密化はP5で対応する(design §6.3の将来拡張)。
 */
export function useOptimisticMutation<TVars, TContext = unknown>(opts: {
  mutationFn: (vars: TVars) => Promise<unknown>;
  onMutate?: (vars: TVars) => Promise<TContext> | TContext;
  onErrorRollback?: (context: TContext | undefined, vars: TVars) => void;
  invalidateKeys: QueryKey[] | ((vars: TVars) => QueryKey[]);
  successMessage?: (vars: TVars) => string | void;
  /** successMessageの代わりにトースト表示を完全に委譲したい場合(例: Undoアクション付きトースト)。
   *  指定時はsuccessMessageは呼ばれない。contextはonMutateの戻り値。 */
  onSuccessCustom?: (vars: TVars, context: TContext | undefined) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: opts.mutationFn,
    onMutate: opts.onMutate,
    onError: (err, vars, context) => {
      opts.onErrorRollback?.(context as TContext | undefined, vars);
      toast.error(errorMessage(err));
    },
    onSuccess: (_data, vars, context) => {
      if (opts.onSuccessCustom) {
        opts.onSuccessCustom(vars, context as TContext | undefined);
        return;
      }
      const msg = opts.successMessage?.(vars);
      if (msg) toast.success(msg);
    },
    onSettled: (_data, _err, vars) => {
      const keys = typeof opts.invalidateKeys === "function" ? opts.invalidateKeys(vars) : opts.invalidateKeys;
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
