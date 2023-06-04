const { configureStore, createSlice } = require("@reduxjs/toolkit");

// Create the imageWorker slice
const imageWorkerSlice = createSlice({
  name: "imageWorker",
  initialState: {
    url: null,
    result: null,
    isRunning: false,
  },
  reducers: {
    setImageUrl: (state, action) => {
      state.url = action.payload;
    },
    setResult: (state, action) => {
      state.result = action.payload;
    },
    setRunning: (state, action) => {
      state.isRunning = action.payload;
    },
  },
});

// Define a counter slice
const counterSlice = createSlice({
  name: "counter",
  initialState: 0,
  reducers: {
    increment: (state) => state + 1,
    decrement: (state) => state - 1,
    reset: () => 0,
  },
});

// Create the Redux store
const store = configureStore({
  reducer: counterSlice.reducer,
  reducer: imageWorkerSlice.reducer,
});


module.exports = {
  store,
  imageWorkerSlice,
};
