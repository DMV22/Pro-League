// This file serves as a central hub for re-exporting pre-typed Redux hooks.
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux"
import type { AppDispatch, RootState } from "./index"

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector