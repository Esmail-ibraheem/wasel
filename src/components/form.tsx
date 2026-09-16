"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Notice } from "./ui";

export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;

/**
 * Thin wrapper around a server action: shows the returned message and passes
 * field errors to children via a render function.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => ReactNode;
  className?: string;
  onSuccess?: (state: NonNullable<ActionState>) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) onSuccess?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className={className}>
      {state?.message && (
        <div className="mb-4">
          <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>
        </div>
      )}
      {children(state)}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText = "جارٍ الحفظ…",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** A one-button form for simple mutations (toggle, delete, status change). */
export function InlineAction({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "sm",
  hidden,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  confirm?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  hidden?: Record<string, string>;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} pendingText="…">
        {children}
      </SubmitButton>
    </form>
  );
}
