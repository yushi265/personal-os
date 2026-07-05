import * as React from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Entity } from "@domain/entity";
import {
  archiveEntity,
  changeEntityStatus,
  createEntity,
  deleteEntity,
  promoteTicket,
  updateEntityField,
} from "@/api/endpoints";
import type { CreateEntityInput, EntityFieldKey, EntityFieldValue } from "@/api/types";
import { priorityChangedUndoNotice, statusChangedUndoNotice, t } from "@i18n/ja";
import { useOptimisticMutation } from "./useOptimisticMutation";

/**
 * status/priorityのインライン編集はProjects一覧行(ProjectRow)・ProjectDetailのチケット表(TicketRow)からも
 * 呼ばれる(a4c275d)。これらは対象entity自身の ["entity", path] クエリを一度も取得していないことが多く、
 * そのキャッシュに読み書きするだけでは(a)楽観的更新が一覧に反映されない (b) previousが取得できずtoastが
 * 出ない、という2つの不具合を招く。呼び出し時に確実に持っている `entity` スナップショットをprevious/patchの
 * 基準にし、entity単体キャッシュ・一覧([\"entities\", *])・親の子一覧([\"entity\", parentPath, \"children\"])の
 * 3箇所をまとめて書き換えることで、呼び出し元がどの画面かによらず即時反映されるようにする。
 */
function patchEntityCaches(queryClient: QueryClient, entity: Entity, patch: Partial<Entity>) {
  queryClient.setQueryData<Entity>(["entity", entity.path], (old) => (old ? { ...old, ...patch } : old));
  queryClient.setQueriesData<Entity[]>({ queryKey: ["entities"], exact: false }, (old) =>
    old?.map((e) => (e.path === entity.path ? { ...e, ...patch } : e))
  );
  if (entity.project) {
    queryClient.setQueryData<Entity[]>(["entity", entity.project, "children"], (old) =>
      old?.map((e) => (e.path === entity.path ? { ...e, ...patch } : e))
    );
  }
}

function entityInvalidateKeys(entity: Entity): QueryKey[] {
  const keys: QueryKey[] = [["entity", entity.path], ["entities"], ["summary"]];
  if (entity.project) keys.push(["entity", entity.project, "children"]);
  return keys;
}

/** 新規Entity作成(プロジェクト一覧のインライン追加・詳細画面の+チケット追加)。作成直後の一覧再取得のみでよく楽観的更新は行わない */
export function useCreateEntity() {
  return useOptimisticMutation<CreateEntityInput>({
    mutationFn: (input) => createEntity(input),
    invalidateKeys: [["entities"]],
  });
}

/** インライン編集(title/status以外/priority/due/親/tags/labels)。statusのみ別途useChangeEntityStatusを使う(EntityFieldService §注釈)
 *  priority変更のみUndoアクション付きトースト対象(一覧・詳細画面共通、team要望)。onSuccessCustom内でmutationRef経由の自己参照により
 *  「元に戻す」実行時も同じ楽観的更新パイプラインでmutateする。 */
export function useUpdateEntityField(entity: Entity | undefined) {
  const queryClient = useQueryClient();
  const mutationRef = React.useRef<ReturnType<
    typeof useOptimisticMutation<{ key: EntityFieldKey; value: EntityFieldValue }, Entity | undefined>
  > | null>(null);
  const isUndoRef = React.useRef(false);

  const mutation = useOptimisticMutation<{ key: EntityFieldKey; value: EntityFieldValue }, Entity | undefined>({
    mutationFn: ({ key, value }) => updateEntityField(entity!.path, key, value),
    onMutate: async ({ key, value }) => {
      if (!entity) return undefined;
      await queryClient.cancelQueries({ queryKey: ["entity", entity.path] });
      const previous = entity;
      patchEntityCaches(queryClient, entity, { [key]: value } as Partial<Entity>);
      return previous;
    },
    onErrorRollback: (previous) => {
      if (previous) patchEntityCaches(queryClient, previous, previous);
    },
    invalidateKeys: entity ? entityInvalidateKeys(entity) : [],
    onSuccessCustom: ({ key, value }, previous) => {
      if (key !== "priority") return;
      if (isUndoRef.current) {
        isUndoRef.current = false;
        toast.success(t("webapp.undo.reverted"));
        return;
      }
      if (!previous) return;
      const from = previous.priority;
      if (from === value) return;
      const fromLabel = from ?? t("manage.field.unset");
      const toLabel = (value as string | undefined) ?? t("manage.field.unset");
      toast.success(priorityChangedUndoNotice(fromLabel, toLabel), {
        action: {
          label: t("undo.action"),
          onClick: () => {
            isUndoRef.current = true;
            mutationRef.current?.mutate({ key: "priority", value: from });
          },
        },
      });
    },
  });
  mutationRef.current = mutation;
  return mutation;
}

export function useChangeEntityStatus(entity: Entity | undefined) {
  const queryClient = useQueryClient();
  const mutationRef = React.useRef<ReturnType<typeof useOptimisticMutation<string, Entity | undefined>> | null>(null);
  const isUndoRef = React.useRef(false);

  const mutation = useOptimisticMutation<string, Entity | undefined>({
    mutationFn: (next) => changeEntityStatus(entity!.path, next),
    onMutate: async (next) => {
      if (!entity) return undefined;
      await queryClient.cancelQueries({ queryKey: ["entity", entity.path] });
      const previous = entity;
      patchEntityCaches(queryClient, entity, { status: next });
      return previous;
    },
    onErrorRollback: (previous) => {
      if (previous) patchEntityCaches(queryClient, previous, previous);
    },
    invalidateKeys: entity ? entityInvalidateKeys(entity) : [],
    onSuccessCustom: (next, previous) => {
      if (isUndoRef.current) {
        isUndoRef.current = false;
        toast.success(t("webapp.undo.reverted"));
        return;
      }
      if (!previous || previous.status === next) return;
      const from = previous.status;
      toast.success(statusChangedUndoNotice(from, next), {
        action: {
          label: t("undo.action"),
          onClick: () => {
            isUndoRef.current = true;
            mutationRef.current?.mutate(from);
          },
        },
      });
    },
  });
  mutationRef.current = mutation;
  return mutation;
}

export function useArchiveEntity(entity: Entity | undefined) {
  return useOptimisticMutation<void>({
    mutationFn: () => archiveEntity(entity!.path),
    invalidateKeys: [["entities"]],
  });
}

export function useDeleteEntity(entity: Entity | undefined) {
  return useOptimisticMutation<void>({
    mutationFn: () => deleteEntity(entity!.path),
    invalidateKeys: [["entities"]],
  });
}

export function usePromoteTicket(entity: Entity | undefined) {
  return useOptimisticMutation<void>({
    mutationFn: () => promoteTicket(entity!.path),
    invalidateKeys: entity ? [["entity", entity.path], ["entities"]] : [],
  });
}
