import { useEffect } from "react"
import { useOverlayScrollbars } from "overlayscrollbars-react"
import "overlayscrollbars/overlayscrollbars.css"

/**
 * Initializes overlay scrollbars on the document body so the page scrollbar
 * is replaced with a smoothly-fading overlay scrollbar. Nested scrollers
 * still get the same treatment via the global CSS in src/index.css (we use
 * `data-overlayscrollbars` attribute to opt them in implicitly via the body
 * initializer's nativeScrollbarsOverlaid setting).
 */
export function useAutoHideScrollbars() {
  const [initialize] = useOverlayScrollbars({
    options: {
      scrollbars: {
        theme: "os-theme-bran",
        autoHide: "scroll",
        autoHideDelay: 700,
        autoHideSuspend: false,
        clickScroll: true,
        dragScroll: true,
      },
      overflow: { x: "scroll", y: "scroll" },
    },
    defer: true,
  })

  useEffect(() => {
    initialize({
      target: document.body,
      cancel: { nativeScrollbarsOverlaid: false },
    })
  }, [initialize])
}
