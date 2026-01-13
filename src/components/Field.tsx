export interface FieldProps {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}
