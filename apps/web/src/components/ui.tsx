import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-stone-300 disabled:text-stone-500',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-stone-700 hover:bg-stone-200/70 disabled:text-stone-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-stone-300',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }>(
  function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
          size === 'sm' && 'px-2.5 py-1 text-sm',
          size === 'md' && 'px-3.5 py-2 text-sm',
          size === 'lg' && 'px-5 py-3 text-base',
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ children, className, as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-label'?: string; 'aria-labelledby'?: string }) {
  return (
    <As className={cx('rounded-2xl bg-white shadow-sm ring-1 ring-stone-200', className)} {...rest}>
      {children}
    </As>
  );
}

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'brand';
const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}

export function Alert({ tone = 'neutral', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('rounded-xl px-3 py-2 text-sm ring-1 ring-inset', tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Progress({ value, label, tone = 'brand', detail }: { value: number; label: string; tone?: 'brand' | 'amber' | 'red' | 'green'; detail?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const bar = { brand: 'bg-brand-500', amber: 'bg-amber-500', red: 'bg-red-500', green: 'bg-emerald-500' }[tone];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-stone-700">{label}</span>
        <span className="tabular-nums text-stone-600">{detail ?? `${pct}%`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={cx('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Spinner({ className, label = 'Cargando' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-600 aria-[invalid=true]:ring-red-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(inputCls, className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(inputCls, className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cx(inputCls, 'pr-8', className)} {...p} />;
});

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
      <p className="font-medium text-stone-800">{title}</p>
      {children}
    </div>
  );
}
