import { Modal, ModalBody, ModalHeader, ModalTitle } from "./modal.jsx";
import { Button } from "./button.jsx";
import { cn } from "../../utils/cn.js";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel
}) {
  const confirmClassName = tone === "danger"
    ? "bg-red-600 text-white hover:bg-red-700"
    : tone === "warning"
      ? "bg-sand-500 text-white hover:bg-sand-600"
      : "";

  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        {description ? <p className="text-sm text-sand-600">{description}</p> : null}
        <div className="mt-6 flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button className={cn(confirmClassName)} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
