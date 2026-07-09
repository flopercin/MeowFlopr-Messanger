import { create } from 'zustand'

const useStore = create((set) => ({
  session: null,
  profile: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
}))

export default useStore
