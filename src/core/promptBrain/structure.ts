export interface SchemaSection {
    heading: string;
    bullets?: string[];
    code?: {
        language: "ts" | "tsx" | "js" | "python";
        content: string;
    };
}

export interface OutputSchema {
    title: string;
    sections: SchemaSection[];
    summary?: string;
}

// Level 4/7: Explicit Schemas
export const LOGIN_PAGE_SCHEMA: OutputSchema = {
    title: "Login Page Implementation Plan",
    sections: [
        { heading: "Tech Stack", bullets: ["Framework", "Styling", "State Management"] },
        { heading: "Security Requirements", bullets: ["Validation", "Sanitization", "CSRF"] },
        { heading: "Architecture", bullets: ["Component Split", "Data Flow"] },
        { heading: "Deliverables", bullets: ["Code Structure", "Explanation"] }
    ]
};

export const GENERAL_SCHEMA: OutputSchema = {
    title: "Response",
    sections: [
        { heading: "Overview" },
        { heading: "Details" },
        { heading: "Action Items" }
    ]
};
