import type { Attachment } from "svelte/attachments";

function formDataToJSON(formData: FormData, { skipBlobs = false } = {}) {
  const obj: Record<string, any> = {};
  // Get the unique keys first (order is preserved across appends)
  const keys = Array.from(formData.keys());
  const uniqueKeys = Array.from(new Set(keys));

  for (const key of uniqueKeys) {
    const all = formData.getAll(key); // collects duplicates
    // Optionally drop Blob/File values if serializing to JSON string
    const values = skipBlobs ? all.filter((v) => !(v instanceof Blob)) : all;

    if (values.length === 0) continue; // nothing to store (all were blobs and skipped)
    obj[key] = values.length === 1 ? values[0] : values;
  }
  return obj;
}

export function action<T = Record<string, any>>(
  callback: (data: T, event: SubmitEvent) => void,
): Attachment {
  return (form: HTMLFormElement) => {
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = formDataToJSON(fd) as T;
      callback(data, e);
    };

    form.addEventListener("submit", onSubmit);

    return () => {
      form.removeEventListener("submit", onSubmit);
    };
  };
}
