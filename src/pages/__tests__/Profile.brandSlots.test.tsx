import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mock supabase client — Profile.tsx imports this at module scope for the
// avatar-upload path, which isn't exercised by these brand-slot tests, but
// the module must still resolve without a real Supabase client.
// ---------------------------------------------------------------------------
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
        remove: vi.fn(),
      })),
    },
    from: vi.fn(() => ({
      update: () => ({ eq: vi.fn() }),
      upsert: vi.fn(),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock AuthContext
// ---------------------------------------------------------------------------
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@example.com" } }),
}));

// ---------------------------------------------------------------------------
// Mock react-router-dom — force the "brand" tab active via the ?tab= param.
// ---------------------------------------------------------------------------
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to, ...props }, children),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams({ tab: "brand" }), vi.fn()],
}));

// ---------------------------------------------------------------------------
// Mock react-helmet-async (no provider mounted in this test)
// ---------------------------------------------------------------------------
vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

// ---------------------------------------------------------------------------
// Mock mediaManager
// ---------------------------------------------------------------------------
vi.mock("@/lib/mediaManager", () => ({
  default: {
    addMediaRef: vi.fn(),
    listMediaRefs: vi.fn(() => []),
    removeMediaRef: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Hoisted mutable fixtures + mock fns for the brand-slot query/mutation hooks.
// Using vi.hoisted so these are initialized before the vi.mock factory below
// (which is itself hoisted above imports by Vitest) runs.
// ---------------------------------------------------------------------------
const {
  brandSlotsState,
  mockCreateBrandSlot,
  mockUpdateBrandSlot,
  mockDeleteBrandSlot,
  mockSetDefaultBrandSlot,
  mockProfileUpdateMutateAsync,
  mockProfileData,
} = vi.hoisted(() => {
  return {
    brandSlotsState: [] as Array<Record<string, unknown>>,
    mockCreateBrandSlot: vi.fn(),
    mockUpdateBrandSlot: vi.fn(),
    mockDeleteBrandSlot: vi.fn(),
    mockSetDefaultBrandSlot: vi.fn(),
    mockProfileUpdateMutateAsync: vi.fn(),
    mockProfileData: {
      display_name: "Jane Doe",
      avatar_url: "",
      default_voice: "",
      default_style: "",
      default_audiences: [] as string[],
      default_goals: [] as string[],
      banned_hashtags: [] as string[],
      required_hashtags: [] as string[],
      default_timezone: "",
    },
  };
});

vi.mock("@/hooks/useAppQueries", () => ({
  useProfileQuery: () => ({
    data: mockProfileData,
    isLoading: false,
    error: null,
  }),
  useProfileUpdateMutation: () => ({ mutateAsync: mockProfileUpdateMutateAsync }),
  useTemplatesQuery: () => ({ data: [], isLoading: false }),
  useDeleteTemplateMutation: () => ({ mutateAsync: vi.fn() }),
  useEnsureDefaultBrandSlot: () => ({
    data: brandSlotsState,
    isLoading: false,
    isSuccess: true,
  }),
  useCreateBrandSlotMutation: () => ({ mutateAsync: mockCreateBrandSlot, isPending: false }),
  useUpdateBrandSlotMutation: () => ({ mutateAsync: mockUpdateBrandSlot, isPending: false }),
  useDeleteBrandSlotMutation: () => ({ mutateAsync: mockDeleteBrandSlot, isPending: false }),
  useSetDefaultBrandSlotMutation: () => ({
    mutateAsync: mockSetDefaultBrandSlot,
    isPending: false,
  }),
}));

import Profile from "../Profile";

function makeSlot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "slot-default",
    user_id: "user-1",
    name: "Default",
    is_default: true,
    forbidden_phrases: [],
    proof_points: [],
    cta_preferences: [],
    preferred_structures: [],
    brand_examples: null,
    default_framework: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderProfile() {
  return render(<Profile />);
}

beforeEach(() => {
  vi.clearAllMocks();
  brandSlotsState.length = 0;
  brandSlotsState.push(
    makeSlot(),
    makeSlot({ id: "slot-2", name: "Side hustle", is_default: false })
  );
  mockProfileUpdateMutateAsync.mockResolvedValue(undefined);
  mockCreateBrandSlot.mockResolvedValue(undefined);
  mockUpdateBrandSlot.mockResolvedValue(undefined);
  mockDeleteBrandSlot.mockResolvedValue(undefined);
  mockSetDefaultBrandSlot.mockResolvedValue(undefined);
});

describe("Profile — brand slots selector", () => {
  it("renders all slots with the default one highlighted", async () => {
    renderProfile();

    const defaultTab = await screen.findByRole("tab", { name: /^Default\s*★?$/ });
    const sideHustleTab = screen.getByRole("tab", { name: /^Side hustle$/ });

    expect(defaultTab).toHaveAttribute("aria-selected", "true");
    expect(sideHustleTab).toHaveAttribute("aria-selected", "false");
    // Default slot is visually marked with a star.
    expect(defaultTab.textContent).toMatch(/★/);
  });

  it("creating a new slot calls the create mutation and selects it", async () => {
    mockCreateBrandSlot.mockImplementation(async (input: { name: string }) => {
      const created = makeSlot({ id: "slot-3", name: input.name, is_default: false });
      brandSlotsState.push(created);
      return created;
    });

    renderProfile();

    fireEvent.click(screen.getByRole("button", { name: /\+ new brand/i }));
    const nameInput = screen.getByLabelText(/new brand name/i);
    fireEvent.change(nameInput, { target: { value: "Consulting" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateBrandSlot).toHaveBeenCalledWith({ name: "Consulting" });
    });

    await waitFor(() => {
      const newTab = screen.getByRole("tab", { name: /^Consulting$/ });
      expect(newTab).toHaveAttribute("aria-selected", "true");
    });
  });

  it("calls the set-default mutation when 'Set as default' is clicked on a non-default slot", async () => {
    renderProfile();

    const setDefaultBtn = await screen.findByRole("button", {
      name: /set side hustle as default brand/i,
    });
    fireEvent.click(setDefaultBtn);

    await waitFor(() => {
      expect(mockSetDefaultBrandSlot).toHaveBeenCalledWith("slot-2");
    });
  });

  it("disables delete for the default slot and requires confirmation for a non-default slot", async () => {
    renderProfile();

    const deleteDefaultBtn = await screen.findByRole("button", { name: /delete default/i });
    expect(deleteDefaultBtn).toBeDisabled();

    const deleteSideHustleBtn = screen.getByRole("button", { name: /delete side hustle/i });
    expect(deleteSideHustleBtn).not.toBeDisabled();

    fireEvent.click(deleteSideHustleBtn);

    // Confirm dialog appears with a warning about calendars falling back to
    // the account default.
    expect(screen.getByText(/fall back to your account's default/i)).toBeInTheDocument();

    const modal = screen.getByText(/fall back to your account's default/i).closest(".modal-body")
      ?.parentElement as HTMLElement;
    const confirmBtn = within(modal).getByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteBrandSlot).toHaveBeenCalledWith("slot-2");
    });
  });

  it("saves brand-memory field edits against the selected (non-default) slot's id", async () => {
    renderProfile();

    // Select the non-default slot.
    fireEvent.click(await screen.findByRole("tab", { name: /^Side hustle$/ }));

    const forbiddenInput = await screen.findByLabelText(/new forbidden phrase/i);
    fireEvent.change(forbiddenInput, { target: { value: "no hype" } });

    // There are multiple "Add" buttons on the page (audiences, proof points,
    // etc.) — find the one in the same row as the forbidden-phrase input.
    const addButtons = screen.getAllByRole("button", { name: /^add$/i });
    const forbiddenAddBtn = addButtons.find(
      (btn) => btn.parentElement === forbiddenInput.parentElement
    );
    expect(forbiddenAddBtn).toBeTruthy();
    fireEvent.click(forbiddenAddBtn as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateBrandSlot).toHaveBeenCalled();
    });
    const call = mockUpdateBrandSlot.mock.calls[0][0];
    expect(call.id).toBe("slot-2");
    expect(call.patch.forbidden_phrases).toContain("no hype");
  });
});
