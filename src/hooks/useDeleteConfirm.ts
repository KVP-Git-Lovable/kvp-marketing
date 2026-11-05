import { useState, useCallback } from "react";

interface DeleteConfirmState {
  isOpen: boolean;
  itemId: string | null;
  itemName?: string;
}

export const useDeleteConfirm = () => {
  const [state, setState] = useState<DeleteConfirmState>({
    isOpen: false,
    itemId: null,
    itemName: undefined,
  });

  const openDeleteDialog = useCallback((itemId: string, itemName?: string) => {
    setState({
      isOpen: true,
      itemId,
      itemName,
    });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setState({
      isOpen: false,
      itemId: null,
      itemName: undefined,
    });
  }, []);

  const setOpen = useCallback((open: boolean) => {
    if (!open) {
      closeDeleteDialog();
    }
  }, [closeDeleteDialog]);

  return {
    isOpen: state.isOpen,
    itemId: state.itemId,
    itemName: state.itemName,
    openDeleteDialog,
    closeDeleteDialog,
    setOpen,
  };
};
