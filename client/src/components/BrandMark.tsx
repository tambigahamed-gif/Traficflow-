export default function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand-mark ${large ? "large" : ""}`} aria-label="TrafficFlow">
      <img src="/brand/trafficflow-logo.png" alt="TrafficFlow" />
    </span>
  );
}
