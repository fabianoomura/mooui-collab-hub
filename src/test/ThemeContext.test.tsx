import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

function Probe() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("light")}>light</button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
  });

  it("applies the theme class to html element", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    const t = screen.getByTestId("theme").textContent;
    expect(["light", "dark"]).toContain(t);
    expect(document.documentElement.classList.contains(t!)).toBe(true);
  });

  it("toggles between light and dark", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    const initial = screen.getByTestId("theme").textContent;
    act(() => {
      screen.getByText("toggle").click();
    });
    const next = screen.getByTestId("theme").textContent;
    expect(next).not.toBe(initial);
  });

  it("persists theme to localStorage", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText("light").click();
    });
    expect(localStorage.getItem("mooui-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("throws when useTheme is used outside provider", () => {
    const orig = console.error;
    console.error = () => {};
    expect(() => render(<Probe />)).toThrow();
    console.error = orig;
  });
});
