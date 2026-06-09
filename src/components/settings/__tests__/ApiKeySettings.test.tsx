import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ApiKeySettings } from "../ApiKeySettings";

// ---------------------------------------------------------------------------
// Mock apiKeyManager
// ---------------------------------------------------------------------------
const mockSaveUserApiKey = vi.fn();
const mockGetUserApiKey = vi.fn();
const mockSetUseOwnKey = vi.fn();
const mockDeleteUserApiKey = vi.fn();

vi.mock("@/lib/apiKeyManager", () => ({
  saveUserApiKey: (...args: unknown[]) => mockSaveUserApiKey(...args),
  getUserApiKey: (...args: unknown[]) => mockGetUserApiKey(...args),
  setUseOwnKey: (...args: unknown[]) => mockSetUseOwnKey(...args),
  deleteUserApiKey: (...args: unknown[]) => mockDeleteUserApiKey(...args),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Default resolved state: no key saved
const NO_KEY_STATE = { apiKey: null, provider: null, useOwnKey: false };

// State with a saved key
const SAVED_KEY_STATE = {
  apiKey: "sk-decryptedkey1234567890abcdef",
  provider: "openai" as const,
  useOwnKey: true,
};

async function renderAndWait(overrideState = NO_KEY_STATE) {
  mockGetUserApiKey.mockResolvedValue(overrideState);
  const result = render(<ApiKeySettings />);
  // Wait for the loading state to resolve
  await waitFor(() => {
    expect(screen.queryByText(/loading api key/i)).not.toBeInTheDocument();
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveUserApiKey.mockResolvedValue(undefined);
  mockSetUseOwnKey.mockResolvedValue(undefined);
  mockDeleteUserApiKey.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// 1. Initial Render
// ---------------------------------------------------------------------------
describe("ApiKeySettings — initial render", () => {
  it("renders provider dropdown with all 3 options", async () => {
    await renderAndWait();

    const select = screen.getByRole("combobox");
    const options = within(select).getAllByRole("option");
    const values = options.map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain("openai");
    expect(values).toContain("anthropic");
    expect(values).toContain("openrouter");
  });

  it("password input is type='password' by default", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("input has autoComplete='new-password' attribute", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key");
    expect(input).toHaveAttribute("autoComplete", "new-password");
  });

  it("input has data-lpignore='true' attribute", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key");
    expect(input).toHaveAttribute("data-lpignore", "true");
  });

  it("input has spellCheck=false", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key");
    expect(input).toHaveAttribute("spellCheck", "false");
  });

  it("privacy notice is present in the DOM without any interaction", async () => {
    await renderAndWait();
    expect(screen.getByText(/encrypted with AES-256/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Show/Hide toggle
// ---------------------------------------------------------------------------
describe("ApiKeySettings — show/hide toggle", () => {
  it("show toggle switches input type to 'text'", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    const toggleBtn = screen.getByRole("button", { name: /show api key/i });

    fireEvent.click(toggleBtn);
    expect(input.type).toBe("text");
  });

  it("hide toggle switches input type back to 'password'", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    const showBtn = screen.getByRole("button", { name: /show api key/i });

    fireEvent.click(showBtn); // show
    const hideBtn = screen.getByRole("button", { name: /hide api key/i });
    fireEvent.click(hideBtn); // hide
    expect(input.type).toBe("password");
  });
});

// ---------------------------------------------------------------------------
// 3. Save button state
// ---------------------------------------------------------------------------
describe("ApiKeySettings — save button behavior", () => {
  it("save button is NOT disabled when input has a value", async () => {
    await renderAndWait();
    // The save button is type=submit and not disabled when no loading state
    const saveBtn = screen.getByRole("button", { name: /save api configuration/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls saveUserApiKey with correct key and provider arguments", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;

    // Set input value via fireEvent (uncontrolled ref)
    fireEvent.change(input, { target: { value: "sk-" + "a".repeat(32) } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSaveUserApiKey).toHaveBeenCalledWith("sk-" + "a".repeat(32), "openai");
    });
  });

  it("calls saveUserApiKey with anthropic provider when selected", async () => {
    await renderAndWait();
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "anthropic" } });

    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    const anthropicKey = "sk-ant-" + "a".repeat(32);
    fireEvent.change(input, { target: { value: anthropicKey } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSaveUserApiKey).toHaveBeenCalledWith(anthropicKey, "anthropic");
    });
  });

  it("after successful save: success message appears with role='status'", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sk-" + "a".repeat(32) } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      const statusEl = screen.getByRole("status");
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent(/saved successfully/i);
    });
  });

  it("after successful save: input is cleared", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sk-" + "a".repeat(32) } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("after failed save: error message appears with role='alert'", async () => {
    mockSaveUserApiKey.mockRejectedValue(new Error("An unexpected error occurred."));
    await renderAndWait();

    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sk-" + "a".repeat(32) } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      const alertEl = screen.getByRole("alert");
      expect(alertEl).toBeInTheDocument();
    });
  });

  it("after INVALID_KEY_FORMAT error: shows provider-specific message", async () => {
    mockSaveUserApiKey.mockRejectedValue(new Error("INVALID_KEY_FORMAT"));
    await renderAndWait();

    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sk-" + "a".repeat(32) } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      const alertEl = screen.getByRole("alert");
      expect(alertEl).toHaveTextContent(/invalid key format for openai/i);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Masked preview
// ---------------------------------------------------------------------------
describe("ApiKeySettings — masked preview", () => {
  it("shows masked preview after successful save", async () => {
    await renderAndWait();
    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    const testKey = "sk-" + "a".repeat(28) + "xQ3Z";
    fireEvent.change(input, { target: { value: testKey } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      // The masked preview "Currently configured key ends in" should appear
      expect(screen.getByText(/currently configured key ends in/i)).toBeInTheDocument();
    });
  });

  it("shows masked preview on load when key exists", async () => {
    await renderAndWait(SAVED_KEY_STATE);
    expect(screen.getByText(/currently configured key ends in/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Enable as fallback toggle
// ---------------------------------------------------------------------------
describe("ApiKeySettings — enable as fallback checkbox", () => {
  it("calls setUseOwnKey on save when checkbox state changes", async () => {
    await renderAndWait();
    const checkbox = screen.getByLabelText(/enable custom api key/i) as HTMLInputElement;

    fireEvent.click(checkbox); // toggle on

    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sk-" + "a".repeat(32) } });

    const form = screen.getByRole("button", { name: /save api configuration/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSetUseOwnKey).toHaveBeenCalledWith(true, 'fallback');
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Delete key flow
// ---------------------------------------------------------------------------
describe("ApiKeySettings — delete key flow", () => {
  it("Remove Key button shows confirmation before calling deleteUserApiKey", async () => {
    // Render with a saved key so Remove Key button appears
    await renderAndWait(SAVED_KEY_STATE);

    const removeBtn = screen.getByRole("button", { name: /remove key/i });
    fireEvent.click(removeBtn);

    // Confirmation section should appear
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    // deleteUserApiKey should NOT have been called yet
    expect(mockDeleteUserApiKey).not.toHaveBeenCalled();
  });

  it("'Yes, remove' button calls deleteUserApiKey", async () => {
    await renderAndWait(SAVED_KEY_STATE);

    fireEvent.click(screen.getByRole("button", { name: /remove key/i }));

    const confirmBtn = screen.getByRole("button", { name: /yes, remove/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteUserApiKey).toHaveBeenCalledOnce();
    });
  });

  it("Cancel button hides confirmation without calling deleteUserApiKey", async () => {
    await renderAndWait(SAVED_KEY_STATE);

    fireEvent.click(screen.getByRole("button", { name: /remove key/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    expect(mockDeleteUserApiKey).not.toHaveBeenCalled();
  });

  it("after delete success: masked preview disappears, success message shown", async () => {
    await renderAndWait(SAVED_KEY_STATE);

    fireEvent.click(screen.getByRole("button", { name: /remove key/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, remove/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/removed successfully/i);
    });

    expect(screen.queryByText(/currently configured key ends in/i)).not.toBeInTheDocument();
  });
});
