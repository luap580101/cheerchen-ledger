import { configureStore } from "@reduxjs/toolkit";
import ledgerReducer from "../features/ledger/ledgerSlice";

export const store = configureStore({
  reducer: {
    ledger: ledgerReducer
  }
});
