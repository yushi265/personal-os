import { useQueryClient } from "@tanstack/react-query";
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
import { useOptimisticMutation } from "./useOptimisticMutation";

/** 新規Entity作成(プロジェクト一覧のインライン追加・詳細画面の+チケット追加)。作成直後の一覧再取得のみでよく楽観的更新は行わない */
export function useCreateEntity() {
  return useOptimisticMutation<CreateEntityInput>({
    mutationFn: (input) => createEntity(input),
    invalidateKeys: [["entities"]],
  });
}

/** インライン編集(title/status以外/priority/due/親/tags/labels)。statusのみ別途useChangeEntityStatusを使う(EntityFieldService §注釈) */
export function useUpdateEntityField(entity: Entity | undefined) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<{ key: EntityFieldKey; value: EntityFieldValue }, Entity | undefined>({
    mutationFn: ({ key, value }) => updateEntityField(entity!.path, key, value),
    onMutate: async ({ key, value }) => {
      if (!entity) return undefined;
      await queryClient.cancelQueries({ queryKey: ["entity", entity.path] });
      const previous = queryClient.getQueryData<Entity>(["entity", entity.path]);
      queryClient.setQueryData<Entity>(["entity", entity.path], (old) => (old ? { ...old, [key]: value } : old));
      return previous;
    },
    onErrorRollback: (previous) => {
      if (entity) queryClient.setQueryData(["entity", entity.path], previous);
    },
    invalidateKeys: entity ? [["entity", entity.path], ["entities"]] : [],
  });
}

export function useChangeEntityStatus(entity: Entity | undefined) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<string, Entity | undefined>({
    mutationFn: (next) => changeEntityStatus(entity!.path, next),
    onMutate: async (next) => {
      if (!entity) return undefined;
      await queryClient.cancelQueries({ queryKey: ["entity", entity.path] });
      const previous = queryClient.getQueryData<Entity>(["entity", entity.path]);
      queryClient.setQueryData<Entity>(["entity", entity.path], (old) => (old ? { ...old, status: next } : old));
      return previous;
    },
    onErrorRollback: (previous) => {
      if (entity) queryClient.setQueryData(["entity", entity.path], previous);
    },
    invalidateKeys: entity ? [["entity", entity.path], ["entities"]] : [],
  });
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
