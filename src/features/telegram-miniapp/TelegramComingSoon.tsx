import { memo } from "react";

type Props = {
  icon: string;
  title: string;
  description: string;
};

function TelegramComingSoon({ icon, title, description }: Props) {
  return (
    <section className="tg-mini-empty">
      <div className="tg-mini-empty__icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export default memo(TelegramComingSoon);
