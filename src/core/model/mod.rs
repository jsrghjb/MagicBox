pub struct Settings {
    /// Show pipeline duration
    pub show_pipeline_duration: bool,
    /// Show pipeline metadata
    pub show_pipeline_metadata: bool,
    /// Show trace link next to workflow status or in metadata
    pub show_trace_link: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            show_pipeline_duration: true,
            show_pipeline_metadata: true,
            show_trace_link: true,
        }
    }
}
