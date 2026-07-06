import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mock supabase client — storage + table update/upsert used by handleAvatarChange
// ---------------------------------------------------------------------------
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();
const mockStorageRemove = vi.fn();
const mockTableUpdateEq = vi.fn();
const mockTableUpsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: (...args: unknown[]) => mockStorageUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockStorageGetPublicUrl(...args),
        remove: (...args: unknown[]) => mockStorageRemove(...args),
      })),
    },
    from: vi.fn(() => ({
      update: (updates: unknown) => ({
        eq: (...args: unknown[]) => mockTableUpdateEq(updates, ...args),
      }),
      upsert: (...args: unknown[]) => mockTableUpsert(...args),
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
// Mock react-router-dom (component is rendered outside a Router in this test)
// ---------------------------------------------------------------------------
const mockSetSearchParams = vi.fn();
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to, ...props }, children),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

// ---------------------------------------------------------------------------
// Mock react-helmet-async (no provider mounted in this test)
// ---------------------------------------------------------------------------
vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

// ---------------------------------------------------------------------------
// Mock mediaManager (localStorage-backed; keep it a no-op spy)
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
// Mock the react-query-backed data hooks used by Profile — avoids needing a
// real QueryClientProvider and keeps this a focused unit test of Profile's
// own avatar-upload and save logic.
// ---------------------------------------------------------------------------
const mockProfileUpdateMutateAsync = vi.fn();
const mockProfileData: Record<string, unknown> = {
  display_name: "Jane Doe",
  avatar_url: "",
  default_voice: "",
  default_style: "",
  default_audiences: [],
  default_goals: [],
};

vi.mock("@/hooks/useAppQueries", () => ({
  useProfileQuery: () => ({ data: mockProfileData, isLoading: false, error: null }),
  useProfileUpdateMutation: () => ({ mutateAsync: mockProfileUpdateMutateAsync }),
  useTemplatesQuery: () => ({ data: [], isLoading: false }),
  useDeleteTemplateMutation: () => ({ mutateAsync: vi.fn() }),
}));

import { toast } from "sonner";
import Profile from "../Profile";

function renderProfile() {
  return render(<Profile />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageUpload.mockResolvedValue({ error: null });
  mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.example.com/avatars/user-1/avatar.png" } });
  mockStorageRemove.mockResolvedValue({ error: null });
  mockTableUpdateEq.mockResolvedValue({ error: null });
  mockTableUpsert.mockResolvedValue({ error: null });
  mockProfileUpdateMutateAsync.mockResolvedValue(undefined);
});

function makeAvatarFile(name = "avatar.png", type = "image/png") {
  return new File(["fake-image-bytes"], name, { type });
}

describe("Profile — avatar upload", () => {
  it("resets the uploading state after a successful upload", async () => {
    renderProfile();
    const input = screen.getByLabelText(/upload new avatar/i) as HTMLInputElement;
    const file = makeAvatarFile();

    fireEvent.change(input, { target: { files: [file] } });

    // Uploading indicator shows while in-flight, then clears.
    await waitFor(() => {
      expect(mockStorageUpload).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/upload new avatar/i)).not.toBeDisabled();
    });
    expect(toast.success).toHaveBeenCalledWith("Avatar updated");
  });

  it("resets the uploading state even when the upload throws", async () => {
    mockStorageUpload.mockRejectedValue(new Error("network blip"));
    renderProfile();
    const input = screen.getByLabelText(/upload new avatar/i) as HTMLInputElement;
    const file = makeAvatarFile();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("network blip");
    });
    // The try/finally must reset `uploading` even though upload() threw.
    await waitFor(() => {
      expect(screen.getByLabelText(/upload new avatar/i)).not.toBeDisabled();
    });
  });

  it("resets the uploading state when the storage upload reports an error object", async () => {
    mockStorageUpload.mockResolvedValue({ error: { message: "Storage quota exceeded" } });
    renderProfile();
    const input = screen.getByLabelText(/upload new avatar/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeAvatarFile()] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Storage quota exceeded");
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/upload new avatar/i)).not.toBeDisabled();
    });
  });

  it("rejects disallowed file types before attempting an upload", async () => {
    renderProfile();
    const input = screen.getByLabelText(/upload new avatar/i) as HTMLInputElement;
    const badFile = makeAvatarFile("virus.exe", "application/octet-stream");

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(toast.error).toHaveBeenCalledWith("Avatar must be PNG, JPEG, or WebP");
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

describe("Profile — profile field save", () => {
  it("saves display name changes via useProfileUpdateMutation and shows a success toast", async () => {
    renderProfile();
    const nameInput = screen.getByLabelText(/display name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockProfileUpdateMutateAsync).toHaveBeenCalled();
    });
    const updates = mockProfileUpdateMutateAsync.mock.calls[0][0];
    expect(updates.display_name).toBe("New Name");
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile updated");
    });
  });

  it("shows an error toast when the profile update mutation fails", async () => {
    mockProfileUpdateMutateAsync.mockRejectedValue(new Error("Update failed: RLS violation"));
    renderProfile();

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed: RLS violation");
    });
  });
});
