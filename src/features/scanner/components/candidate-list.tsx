import { ProductCard } from "@/features/catalog/components/product-card";
import type { RankedCandidate } from "@/features/scanner/domain/matching";

export function CandidateList({
  candidates,
  selectedId,
  onSelect,
}: {
  candidates: RankedCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="candidate-list"
      role="radiogroup"
      aria-label="Product matches"
    >
      {candidates.map((candidate) => (
        <label className="candidate-option" key={candidate.product.id}>
          <input
            checked={selectedId === candidate.product.id}
            name="candidate"
            onChange={() => onSelect(candidate.product.id)}
            type="radio"
            value={candidate.product.id}
          />
          <ProductCard product={candidate.product} />
          <span>{Math.round(candidate.score * 100)}% match</span>
        </label>
      ))}
    </div>
  );
}
