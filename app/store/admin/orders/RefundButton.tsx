"use client";

export default function RefundButton() {
  return (
    <button
      type="submit"
      style={{ color: "crimson" }}
      onClick={(e) => {
        if (
          !confirm(
            "Refund this order for the amount entered? This reverses payment to the merchant and cannot be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      Refund
    </button>
  );
}
