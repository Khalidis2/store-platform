function reportClientError(name: string, message: string) {
  const payload = JSON.stringify({
    name: name.slice(0, 100),
    message: message.slice(0, 500),
    path: window.location.pathname.slice(0, 300),
  });

  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

window.addEventListener("error", (event) => {
  const error = event.error instanceof Error ? event.error : null;
  reportClientError(error?.name ?? "ClientError", error?.message ?? event.message ?? "Unhandled client error");
});

window.addEventListener("unhandledrejection", (event) => {
  if (event.reason instanceof Error) {
    reportClientError(event.reason.name || "UnhandledRejection", event.reason.message);
    return;
  }

  reportClientError("UnhandledRejection", "Unhandled promise rejection");
});
