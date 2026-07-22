import reducer from '@/features/league/slices/league.slice'
import { configureStore } from '@reduxjs/toolkit'

export const store = configureStore({
  reducer: reducer,
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch