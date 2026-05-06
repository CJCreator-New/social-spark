/**
 * Draft Recovery Dialog
 *
 * Modal that appears when the app loads and finds saved draft versions.
 * Allows users to restore a previous draft or start fresh.
 *
 * Usage:
 * ```typescript
 * import { DraftRecoveryDialog } from '@/components/DraftRecoveryDialog';
 *
 * export function Index() {
 *   return <DraftRecoveryDialog />;
 * }
 * ```
 */

import React, { useState, useEffect } from "react";
import { useDraftHistory } from "@/contexts/DraftContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, Trash2 } from "lucide-react";
import { formatTimestamp } from "@/lib/draftHistory";

/**
 * Props for the DraftRecoveryDialog component.
 */
interface DraftRecoveryDialogProps {
  /** Callback when a version is restored */
  onRestore?: (versionId: string) => void;
  /** Callback when dialog is dismissed */
  onDismiss?: () => void;
}

/**
 * DraftRecoveryDialog Component
 *
 * Shows on app load if:
 * 1. Draft history is available
 * 2. There are saved versions
 * 3. More than 1 hour has passed since last save
 *
 * Offers to restore the latest version or browse history.
 */
export function DraftRecoveryDialog({ onRestore, onDismiss }: DraftRecoveryDialogProps) {
  const { versions, latestVersion, isAvailable, deleteVersion } = useDraftHistory();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeletingVersion, setIsDeletingVersion] = useState<string | null>(null);

  // Show dialog if conditions are met
  useEffect(() => {
    if (!isAvailable || !versions || versions.length === 0) {
      setIsOpen(false);
      return;
    }

    // Only show if at least 1 hour has passed since last save
    const lastVersion = versions[0];
    if (!lastVersion) {
      setIsOpen(false);
      return;
    }

    const hoursSinceLastSave = (Date.now() - lastVersion.timestamp.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSave < 1) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setSelectedVersionId(lastVersion.id); // Pre-select latest
  }, [versions, isAvailable]);

  if (!isAvailable || !versions || versions.length === 0) {
    return null;
  }

  const handleRestore = async () => {
    if (!selectedVersionId) return;

    setIsRestoring(true);
    try {
      await (await import("@/lib/draftHistory")).draftHistoryService.restoreVersion(selectedVersionId);
      onRestore?.(selectedVersionId);

      // Close dialog after successful restore
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to restore draft:", err);
      alert("Failed to restore draft. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteVersion = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setIsDeletingVersion(versionId);
    try {
      await deleteVersion(versionId);
      if (selectedVersionId === versionId) {
        setSelectedVersionId(versions[0]?.id || null);
      }
    } catch (err) {
      console.error("Failed to delete version:", err);
      alert("Failed to delete version. Please try again.");
    } finally {
      setIsDeletingVersion(null);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Recover Draft?
          </DialogTitle>
          <DialogDescription>
            We found {versions.length} saved version{versions.length > 1 ? "s" : ""} of your work. Would you like to
            restore one?
          </DialogDescription>
        </DialogHeader>

        {/* Version List */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {versions.map((version) => (
            <Card
              key={version.id}
              className={`cursor-pointer transition-all ${
                selectedVersionId === version.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
              }`}
              onClick={() => setSelectedVersionId(version.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Version Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{version.label}</h4>
                      <span className="text-xs text-gray-500">{formatTimestamp(version.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">{version.preview}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>{version.industry || "No industry selected"}</span>
                      <span>•</span>
                      <span>{version.postCount} post{version.postCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteVersion(version.id, e)}
                    disabled={isDeletingVersion === version.id}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Delete this version"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-blue-900">
            <p className="font-semibold">Restoring will create a new version</p>
            <p className="text-xs mt-1 opacity-75">Your selected draft will be restored and saved as a new version. All previous versions remain available.</p>
          </div>
        </div>

        {/* Actions */}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleDismiss}>
            Start Fresh
          </Button>
          <Button
            onClick={handleRestore}
            disabled={!selectedVersionId || isRestoring}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRestoring ? "Restoring..." : "Restore Selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Minimal version that only shows latest draft recovery (no modal).
 * Can be placed inline without dialog UI.
 *
 * Usage:
 * ```typescript
 * <DraftRecoveryBanner onRestore={() => setShowForm(true)} />
 * ```
 */
export function DraftRecoveryBanner({
  onRestore,
  onDismiss,
}: {
  onRestore?: (versionId: string) => void;
  onDismiss?: () => void;
}) {
  const { latestVersion, isAvailable } = useDraftHistory();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isAvailable || !latestVersion) {
      setIsVisible(false);
      return;
    }

    // Show banner if at least 2 hours has passed
    const hoursSinceLastSave = (Date.now() - latestVersion.timestamp.getTime()) / (1000 * 60 * 60);
    setIsVisible(hoursSinceLastSave >= 2);
  }, [latestVersion, isAvailable]);

  if (!isVisible || !latestVersion) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-amber-600" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">Recover draft from {formatTimestamp(latestVersion.timestamp)}?</p>
          <p className="text-xs text-amber-700 mt-1">{latestVersion.preview}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsVisible(false);
            onDismiss?.();
          }}
          className="border-amber-200 text-amber-700 hover:bg-amber-100"
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onRestore?.(latestVersion.id);
            setIsVisible(false);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          Restore
        </Button>
      </div>
    </div>
  );
}
