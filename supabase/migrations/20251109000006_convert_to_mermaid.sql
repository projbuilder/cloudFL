-- ========================================
-- Convert Existing Modules to Use Mermaid Diagrams
-- ========================================
-- This migration converts placeholder image URLs to Mermaid diagrams
-- for existing course modules

-- Function to intelligently convert placeholder images to contextual Mermaid diagrams
CREATE OR REPLACE FUNCTION convert_placeholder_to_mermaid(content_text TEXT) 
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  result := content_text;
  
  -- CLOUD COMPUTING TOPICS
  
  -- Virtualization
  result := regexp_replace(result, 
    '!\[.*?[Vv]irtualiz.*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph TB\n    Physical[Physical Hardware] --> Hypervisor[Hypervisor Layer]\n    Hypervisor --> VM1[VM: Web Server]\n    Hypervisor --> VM2[VM: Database]\n    Hypervisor --> VM3[VM: App Server]\n    VM1 --> Guest1[Guest OS + Apps]\n    VM2 --> Guest2[Guest OS + DB]\n    VM3 --> Guest3[Guest OS + Services]\n```',
    'gi');
  
  -- Cloud architecture
  result := regexp_replace(result,
    '!\[.*?[Cc]loud.*?[Aa]rchitecture.*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph LR\n    Users[Users] --> LB[Load Balancer]\n    LB --> Web1[Web Server 1]\n    LB --> Web2[Web Server 2]\n    Web1 --> App[Application Tier]\n    Web2 --> App\n    App --> DB[(Database)]\n    App --> Cache[(Cache)]\n```',
    'gi');
  
  -- NETWORKING TOPICS
  
  -- Network topology
  result := regexp_replace(result,
    '!\[.*?[Nn]etwork.*?[Tt]opology.*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph TB\n    Internet((Internet)) --> Firewall[Firewall]\n    Firewall --> Router[Core Router]\n    Router --> Switch1[Switch - Floor 1]\n    Router --> Switch2[Switch - Floor 2]\n    Switch1 --> PC1[Workstation 1]\n    Switch1 --> PC2[Workstation 2]\n    Switch2 --> Server1[File Server]\n    Switch2 --> Server2[Mail Server]\n```',
    'gi');
  
  -- OSI Model / Layers
  result := regexp_replace(result,
    '!\[.*?([Oo][Ss][Ii]|[Ll]ayer|[Pp]rotocol [Ss]tack).*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph TD\n    App[Application Layer<br/>HTTP, FTP, SMTP] --> Pres[Presentation Layer<br/>SSL, Encryption]\n    Pres --> Session[Session Layer<br/>Sessions, Connections]\n    Session --> Transport[Transport Layer<br/>TCP, UDP]\n    Transport --> Network[Network Layer<br/>IP, Routing]\n    Network --> DataLink[Data Link Layer<br/>MAC, Switching]\n    DataLink --> Physical[Physical Layer<br/>Cables, Signals]\n```',
    'gi');
  
  -- SECURITY TOPICS
  
  -- Security / Firewall
  result := regexp_replace(result,
    '!\[.*?([Ss]ecurity|[Ff]irewall|[Ee]ncryption).*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph LR\n    User[User] --> |Encrypted| Firewall[Firewall]\n    Firewall --> |Filtered| IDS[IDS/IPS]\n    IDS --> |Inspected| Server[Application Server]\n    Server --> |Secured| Data[(Protected Data)]\n```',
    'gi');
  
  -- Authentication flow
  result := regexp_replace(result,
    '!\[.*?([Aa]uth|[Ll]ogin|[Aa]ccess).*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\nsequenceDiagram\n    User->>+System: Login Request\n    System->>+AuthServer: Validate Credentials\n    AuthServer->>+Database: Check User\n    Database-->>-AuthServer: User Data\n    AuthServer-->>-System: Token\n    System-->>-User: Access Granted\n```',
    'gi');
  
  -- DATA TOPICS
  
  -- Database / Data flow
  result := regexp_replace(result,
    '!\[.*?([Dd]atabase|[Dd]ata|[Ss][Qq][Ll]).*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph TD\n    App[Application] --> |Query| Cache{Cache?}\n    Cache -->|Hit| Return1[Return Cached Data]\n    Cache -->|Miss| DB[(Database)]\n    DB --> Process[Process Query]\n    Process --> Return2[Return Fresh Data]\n    Return2 --> UpdateCache[Update Cache]\n```',
    'gi');
  
  -- HARDWARE TOPICS
  
  -- Circuit / Hardware
  result := regexp_replace(result,
    '!\[.*?([Cc]ircuit|[Hh]ardware|[Cc]hip).*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph LR\n    Input[Input Signal] --> Gate1[Logic Gate 1]\n    Gate1 --> Processor[Processing Unit]\n    Processor --> Gate2[Logic Gate 2]\n    Gate2 --> Output[Output Signal]\n    Processor --> Memory[(Memory)]\n```',
    'gi');
  
  -- PROCESS FLOWS
  
  -- Flowchart / Process
  result := regexp_replace(result,
    '!\[.*?([Ff]low|[Pp]rocess|[Ss]teps|[Ww]orkflow).*?\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\nflowchart TD\n    Start([Start Process]) --> Input[Receive Input]\n    Input --> Validate{Valid?}\n    Validate -->|Yes| Process[Process Data]\n    Validate -->|No| Error[Show Error]\n    Error --> Input\n    Process --> Save[(Save Result)]\n    Save --> End([End])\n```',
    'gi');
  
  -- Generic fallback (simple but clear)
  result := regexp_replace(result,
    '!\[([^\]]+)\]\(https://via\.placeholder\.com[^)]+\)',
    E'```mermaid\ngraph LR\n    A[Start] --> B[Process]\n    B --> C[Result]\n    C --> D[Output]\n```',
    'gi');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all existing course modules
UPDATE public.course_modules
SET content = convert_placeholder_to_mermaid(content)
WHERE content LIKE '%via.placeholder.com%';

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.course_modules
  WHERE content LIKE '%```mermaid%';
  
  RAISE NOTICE 'Updated % modules with Mermaid diagrams', updated_count;
END $$;

-- Drop the function (cleanup)
DROP FUNCTION IF EXISTS convert_placeholder_to_mermaid(TEXT);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration complete! Existing modules now use Mermaid diagrams.';
END $$;
