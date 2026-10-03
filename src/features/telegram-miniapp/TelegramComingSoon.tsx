import { memo } from "react";
import { useI18n } from "../../i18n";

type Props = {
  icon: string;
  title: string;
  description: string;
};

function TelegramComingSoon({ icon, title, description }: Props) {
  const { tx } = useI18n();
  return (
    <section className="tg-mini-empty">
      <div className="tg-mini-empty__icon">{icon}</div>
      <h2>{tx(title)}</h2>
      <p>{tx(description)}</p>
    </section>
  );
}

export default memo(TelegramComingSoon);
