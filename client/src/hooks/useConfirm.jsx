import { useCallback, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ui/confirm-dialog.jsx";

const defaultOptions = {
  title: "Are you sure?",
  description: "This action cannot be undone.",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "danger"
};

export function useConfirm() {
  const resolverRef = useRef(null);
  const [options, setOptions] = useState({
    ...defaultOptions,
    open: false
  });

  const confirm = useCallback((nextOptions = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        ...defaultOptions,
        ...nextOptions,
        open: true
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setOptions((prev) => ({ ...prev, open: false }));
  }, []);

  const dialog = useMemo(() => (
    <ConfirmDialog
      open={options.open}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      tone={options.tone}
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  ), [options, handleClose]);

  return { confirm, dialog };
}
