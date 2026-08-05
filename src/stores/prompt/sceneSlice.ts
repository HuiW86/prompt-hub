import { ipc } from "../../ipc";

import type { PromptState, StateCreatorSlice } from "./types";

export const createSceneSlice: StateCreatorSlice<
  Pick<
    PromptState,
    | "createPhrase"
    | "updatePhrase"
    | "deletePhrase"
    | "reorderPhrases"
    | "movePhrase"
    | "createScene"
    | "updateScene"
    | "deleteScene"
    | "reorderScenes"
    | "createSubStage"
    | "updateSubStage"
    | "deleteSubStage"
    | "reorderSubStages"
  >
> = (_set, _get, { refreshScenes }) => ({
  // Scene phrases live inside the deeply-nested `scenes` tree, so every mutation
  // re-pulls listScenesWithChildren (same path promoteDraft uses) instead of
  // patching the nested structure in place. No optimistic update.
  createPhrase: async ({ sceneId, name, content, subStageId }) => {
    await ipc.createPhrase({ sceneId, name, content, subStageId });
    await refreshScenes();
  },

  updatePhrase: async ({ id, name, content, subStageId }) => {
    await ipc.updatePhrase({ id, name, content, subStageId });
    await refreshScenes();
  },

  deletePhrase: async (id) => {
    await ipc.deletePhrase(id);
    await refreshScenes();
  },

  reorderPhrases: async (sceneId, subStageId, orderedIds) => {
    await ipc.reorderPhrases(sceneId, subStageId, orderedIds);
    await refreshScenes();
  },

  // Await the receipt BEFORE re-pulling so the caller gets it even though the
  // scenes tree refresh follows; rethrow on failure so a rejected move / undo
  // reaches the UI's error toast instead of being swallowed.
  movePhrase: async ({
    id,
    targetSceneId,
    targetSubStageId,
    targetOrderIndex,
  }) => {
    const receipt = await ipc.movePhrase({
      id,
      targetSceneId,
      targetSubStageId,
      targetOrderIndex,
    });
    await refreshScenes();
    return receipt;
  },

  // Scene + sub-stage structure mutations share the phrase re-pull path: the
  // `scenes` tree is deeply nested (scene → sub_stages + phrases), so a full
  // re-pull is simpler and cheaper than patching in place. deleteScene lets the
  // backend's SceneNotEmpty error propagate so the UI can surface it.
  createScene: async ({ name, icon, rolePresets, color }) => {
    await ipc.createScene({ name, icon, rolePresets, color });
    await refreshScenes();
  },

  updateScene: async ({ id, name, icon, rolePresets, color }) => {
    await ipc.updateScene({ id, name, icon, rolePresets, color });
    await refreshScenes();
  },

  deleteScene: async (id) => {
    await ipc.deleteScene(id);
    await refreshScenes();
  },

  reorderScenes: async (orderedIds) => {
    await ipc.reorderScenes(orderedIds);
    await refreshScenes();
  },

  createSubStage: async ({ sceneId, name }) => {
    const created = await ipc.createSubStage({ sceneId, name });
    await refreshScenes();
    return created;
  },

  updateSubStage: async ({ id, name }) => {
    await ipc.updateSubStage({ id, name });
    await refreshScenes();
  },

  deleteSubStage: async (id) => {
    await ipc.deleteSubStage(id);
    await refreshScenes();
  },

  reorderSubStages: async (sceneId, orderedIds) => {
    await ipc.reorderSubStages(sceneId, orderedIds);
    await refreshScenes();
  },
});
