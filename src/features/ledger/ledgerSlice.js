import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

const today = new Date().toISOString().slice(0, 10);

export const addTransaction = createAsyncThunk(
  "ledger/addTransaction",
  async (payload, { rejectWithValue }) => {
    try {
      if (!payload.uid) {
        return rejectWithValue("Not authenticated");
      }

      await addDoc(collection(db, "transactions"), {
        ...payload,
        amount: Number(payload.amount),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to add transaction");
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  "ledger/deleteTransaction",
  async ({ id }, { rejectWithValue }) => {
    try {
      if (!id) {
        return rejectWithValue("Missing transaction id");
      }

      await deleteDoc(doc(db, "transactions", id));
      return id;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to delete transaction");
    }
  }
);

const ledgerSlice = createSlice({
  name: "ledger",
  initialState: {
    transactions: [],
    selectedDate: today,
    syncStatus: "idle",
    submitStatus: "idle",
    deleteStatus: "idle",
    error: null
  },
  reducers: {
    setTransactions: (state, action) => {
      state.transactions = action.payload;
      state.syncStatus = "synced";
    },
    setSyncStatus: (state, action) => {
      state.syncStatus = action.payload;
    },
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(addTransaction.pending, (state) => {
        state.submitStatus = "loading";
      })
      .addCase(addTransaction.fulfilled, (state) => {
        state.submitStatus = "succeeded";
        state.error = null;
      })
      .addCase(addTransaction.rejected, (state, action) => {
        state.submitStatus = "failed";
        state.error = action.payload || "Failed to add transaction";
      })
      .addCase(deleteTransaction.pending, (state) => {
        state.deleteStatus = "loading";
      })
      .addCase(deleteTransaction.fulfilled, (state) => {
        state.deleteStatus = "succeeded";
        state.error = null;
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.error = action.payload || "Failed to delete transaction";
      });
  }
});

export const { setTransactions, setSyncStatus, setSelectedDate } = ledgerSlice.actions;

export default ledgerSlice.reducer;
