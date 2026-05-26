import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import App from "./App"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </GoogleOAuthProvider>
)
