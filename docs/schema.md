erDiagram

COMPETITOR {
  uuid id PK
  text name
  text type
  text region
  jsonb domains
  timestamp created_at
}

CRITERIA {
  uuid id PK
  text name
  text category
  uuid parent_id
}

SCAN {
  uuid id PK
  uuid competitor_id FK
  timestamp started_at
  timestamp completed_at
}

PAGE {
  uuid id PK
  uuid competitor_id FK
  text url
  text content_hash
  text raw_html
  text cleaned_text
  timestamp scanned_at
}

CHANGE_EVENT {
  uuid id PK
  uuid page_id FK
  text change_type
  text diff_summary
  timestamp created_at
}

DATA_POINT {
  uuid id PK
  uuid competitor_id FK
  uuid criteria_id FK
  text value
  text confidence
  text source_url
  timestamp created_at
}

INSIGHT {
  uuid id PK
  uuid competitor_id FK
  text type
  text content
  timestamp created_at
}