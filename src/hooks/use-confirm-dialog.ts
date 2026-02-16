import { useState } from "react";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "default",
  });

  const confirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      confirmText?: string;
      cancelText?: string;
      variant?: "default" | "destructive";
    }
  ) => {
    setDialog({
      open: true,
      title,
      description,
      onConfirm: async () => {
        await onConfirm();
        setDialog((prev) => ({ ...prev, open: false }));
      },
      confirmText: options?.confirmText || "Confirm",
      cancelText: options?.cancelText || "Cancel",
      variant: options?.variant || "default",
    });
  };

  const close = () => {
    setDialog((prev) => ({ ...prev, open: false }));
  };

  return {
    dialog,
    confirm,
    close,
  };
}









