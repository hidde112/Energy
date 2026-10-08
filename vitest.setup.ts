import "@testing-library/jest-dom/vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  document.body.innerHTML = "";
});
