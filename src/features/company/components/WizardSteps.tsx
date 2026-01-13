type Props = {
  step: number;
  setStep: (n: number) => void;
  labels: string[];
};

export default function WizardSteps({ step, setStep, labels }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {labels.map((l, i) => {
        const active = i === step;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setStep(i)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: active ? "#111" : "#fff",
              color: active ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {i + 1}. {l}
          </button>
        );
      })}
    </div>
  );
}
