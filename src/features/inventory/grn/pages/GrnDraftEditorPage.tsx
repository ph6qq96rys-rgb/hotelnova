import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import {
  grnApi,
  type GrnScope,
} from "../api/grnApi";
import { getApiErrorMessage } from "../helpers/grn.errors";
import {
  buildGrnDetailPath,
  buildGrnEditPath,
  buildGrnListPath,
} from "../helpers/grn.navigation";
import GrnHeaderForm from "../components/GrnHeaderForm";
import GrnLinesTable from "../components/GrnLinesTable";
import GrnEditorFooter from "../components/GrnEditorFooter";
import { useGrnDraftForm } from "../hooks/useGrnDraftForm";
import { useGrnLookups } from "../hooks/useGrnLookups";
import "../styles/GrnPages.erp.css";
import "../styles/GrnEditor.css";

function money(value: unknown): string {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? parsed : 0;

  return safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function getResultId(
  value:
    | {
        id?: string | null;
        draftId?: string | null;
        grnId?: string | null;
      }
    | null
    | undefined,
): string | undefined {
  return (
    clean(value?.id) ||
    clean(value?.draftId) ||
    clean(value?.grnId) ||
    undefined
  );
}

export default function GrnDraftEditorPage() {
  const navigate = useNavigate();

  const {
    grnId,
    draftId,
    id,
  } = useParams<{
    grnId?: string;
    draftId?: string;
    id?: string;
  }>();

  const {
    companyId,
    branchId,
  } = useAppScope();

  const resolvedId = grnId ?? draftId ?? id;

  const scope = useMemo<GrnScope | null>(
    () =>
      companyId
        ? {
            companyId,
            branchId: branchId ?? undefined,
          }
        : null,
    [branchId, companyId],
  );

  const lookups = useGrnLookups(companyId);
  const draft = useGrnDraftForm(
    scope,
    resolvedId,
    lookups.itemMap,
  );

  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /*
   * Prevents duplicate actions before React has time to rerender and disable
   * the buttons after setSaving() or setPosting().
   */
  const operationInProgressRef = useRef(false);

  /*
   * Tracks the latest item-selection request for each line index so that a
   * slower response from an older selection cannot overwrite a newer one.
   */
  const itemRequestVersionRef = useRef<Map<number, number>>(
    new Map(),
  );

  const busy =
    saving ||
    posting ||
    draft.loadingDraft;

  const clearMessages = useCallback(() => {
    setSubmitError(null);
    setSuccessMsg(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors = draft.validate();
    return !draft.hasErrors(errors);
  }, [draft]);

  /*
   * Creates or updates the current draft and always returns its persisted ID.
   * When a new draft is created, its ID is immediately written into form state
   * so that a later retry updates the same draft instead of creating another.
   */
  const persistDraft = useCallback(async (): Promise<{
    id: string;
    created: boolean;
  }> => {
    if (!scope) {
      throw new Error("A company scope is required.");
    }

    const existingId = clean(draft.form.id);
    const payload = draft.buildPayload(branchId);

    const result = existingId
      ? await grnApi.updateDraft(
          scope,
          existingId,
          payload,
        )
      : await grnApi.createDraft(
          scope,
          payload,
        );

    const savedId =
      existingId ||
      getResultId(result);

    if (!savedId) {
      throw new Error(
        "Draft was saved, but the server did not return a GRN ID.",
      );
    }

    if (!existingId) {
      draft.setForm((current) => ({
        ...current,
        id: savedId,
      }));
    }

    return {
      id: savedId,
      created: !existingId,
    };
  }, [
    branchId,
    draft,
    scope,
  ]);

  const save = useCallback(async () => {
    if (
      !scope ||
      !companyId ||
      draft.loadingDraft ||
      operationInProgressRef.current
    ) {
      return;
    }

    clearMessages();

    if (!validateForm()) {
      return;
    }

    operationInProgressRef.current = true;
    setSaving(true);

    try {
      const persisted = await persistDraft();

      setSuccessMsg("Goods receipt draft saved.");

      if (persisted.created) {
        navigate(
          buildGrnEditPath(
            companyId,
            persisted.id,
          ),
          {
            replace: true,
          },
        );
      }
    } catch (err) {
      setSubmitError(
        getApiErrorMessage(
          err,
          "Failed to save goods receipt draft.",
        ),
      );
    } finally {
      setSaving(false);
      operationInProgressRef.current = false;
    }
  }, [
    clearMessages,
    companyId,
    draft.loadingDraft,
    navigate,
    persistDraft,
    scope,
    validateForm,
  ]);

  const post = useCallback(async () => {
    if (
      !scope ||
      !companyId ||
      draft.loadingDraft ||
      operationInProgressRef.current
    ) {
      return;
    }

    clearMessages();

    if (!validateForm()) {
      return;
    }

    operationInProgressRef.current = true;
    setPosting(true);

    try {
      /*
       * Always save the latest form contents before posting.
       * persistDraft() also stores a newly created ID in form state, preventing
       * duplicate drafts if posting fails and the user retries.
       */
      const persisted = await persistDraft();

      /*
       * A successful postDraft() call means the server accepted the posting
       * request. Do not immediately call getById() and require POSTED, because
       * the backend may update that status asynchronously.
       */
      await grnApi.postDraft(
        scope,
        persisted.id,
      );

      navigate(
        buildGrnDetailPath(
          companyId,
          persisted.id,
        ),
        {
          replace: true,
          state: {
            posted: true,
            postingSubmitted: true,
          },
        },
      );
    } catch (err) {
      setSubmitError(
        getApiErrorMessage(
          err,
          "Failed to post goods receipt.",
        ),
      );
    } finally {
      setPosting(false);
      operationInProgressRef.current = false;
    }
  }, [
    clearMessages,
    companyId,
    draft.loadingDraft,
    navigate,
    persistDraft,
    scope,
    validateForm,
  ]);

  const onItemSelected = useCallback(
    async (
      itemId: string,
      index: number,
    ) => {
      const requestVersion =
        (itemRequestVersionRef.current.get(index) ?? 0) + 1;

      itemRequestVersionRef.current.set(
        index,
        requestVersion,
      );

      setSubmitError(null);

      if (!itemId) {
        draft.patchLine(index, {
          itemId: "",
          uomId: "",
        });

        return;
      }

      const cachedItem =
        lookups.itemMap.get(itemId);

      draft.patchLine(index, {
        itemId,
        uomId:
          cachedItem?.defaultUomId ??
          "",
      });

      try {
        const item =
          await lookups.ensureItem(itemId);

        /*
         * Ignore this response if another item was selected on the same line
         * while the request was in progress.
         */
        if (
          itemRequestVersionRef.current.get(index) !==
          requestVersion
        ) {
          return;
        }

        draft.patchLine(index, {
          itemId,
          uomId:
            item?.defaultUomId ||
            item?.uoms?.[0]?.value ||
            "",
        });
      } catch (err) {
        /*
         * Do not display an error for an obsolete request after the user has
         * already selected a different item.
         */
        if (
          itemRequestVersionRef.current.get(index) !==
          requestVersion
        ) {
          return;
        }

        setSubmitError(
          getApiErrorMessage(
            err,
            "Failed to load item UOM details.",
          ),
        );
      }
    },
    [
      draft,
      lookups,
    ],
  );

  const handleCancel = useCallback(() => {
    if (!companyId || busy) {
      return;
    }

    navigate(
      buildGrnListPath(companyId),
    );
  }, [
    busy,
    companyId,
    navigate,
  ]);

  if (!companyId) {
    return (
      <main className="page grn-editor-page">
        <section className="erp-empty-state">
          <h2>Select a company</h2>
          <p>
            Select a company workspace before creating goods receipts.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page grn-editor-page">
      <header className="erp-grn-hero">
        <div>
          <button
            type="button"
            className="erp-back-link"
            disabled={busy}
            onClick={() =>
              navigate(
                buildGrnListPath(companyId),
              )
            }
          >
            - Goods Receipts
          </button>

          <div className="erp-kicker">
            Inventory - Receiving
          </div>

          <h1>
            {resolvedId
              ? "Edit Goods Receipt"
              : "New Goods Receipt"}
          </h1>

          <p>
            Receive goods into an approved stock location. Save as
            draft or post after review.
          </p>
        </div>

        <div className="grn-editor-total">
          <span>Document Total</span>
          <strong>
            ${money(draft.subtotal)}
          </strong>
        </div>
      </header>

      {submitError ? (
        <div className="alert alert-danger">
          {submitError}
        </div>
      ) : null}

      {lookups.error ? (
        <div className="alert alert-danger">
          {lookups.error}
        </div>
      ) : null}

      {draft.draftError ? (
        <div className="alert alert-danger">
          {draft.draftError}
        </div>
      ) : null}

      {successMsg ? (
        <div className="alert alert-success">
          {successMsg}
        </div>
      ) : null}

      {draft.loadingDraft ? (
        <div className="erp-inline-state">
          Loading goods receipt draft...
        </div>
      ) : null}

      <GrnHeaderForm
        form={draft.form}
        errors={draft.errors}
        locations={lookups.locations}
        loadingLocations={lookups.loadingLocations}
        busy={busy}
        onPatch={draft.patch}
      />

      <GrnLinesTable
        lines={draft.form.lines}
        errors={draft.errors}
        itemOptions={lookups.itemOptions}
        itemMap={lookups.itemMap}
        loadingItems={lookups.loadingItems}
        busy={busy}
        onAddLine={draft.addLine}
        onRemoveLine={draft.removeLine}
        onPatchLine={draft.patchLine}
        onItemSelected={onItemSelected}
      />

      <GrnEditorFooter
        id={draft.form.id}
        busy={busy}
        saving={saving}
        posting={posting}
        onCancel={handleCancel}
        onSave={() => {
          void save();
        }}
        onPost={() => {
          void post();
        }}
      />
    </main>
  );
}