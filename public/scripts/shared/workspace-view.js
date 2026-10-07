export const VIDEO_VIEW = 'view-video'

// Keyboard shortcuts for annotating (etogram keys, Delete) must only act while the video view is on screen.
export const isVideoViewActive = () => (document.body?.dataset.view ?? VIDEO_VIEW) === VIDEO_VIEW
