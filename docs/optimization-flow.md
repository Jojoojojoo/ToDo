# 載入優化流程圖

## 問題診斷流程

```mermaid
graph TD
    A[使用者訪問專案列表頁面] --> B{檢查快取}
    B -->|無快取| C[發送 API 請求]
    B -->|有快取但過期| C
    C --> D[Supabase 執行查詢]
    D --> E[套用 RLS 政策]
    E --> F{對每一列專案}
    F --> G[呼叫 is_project_accessible 函數]
    G --> H[子查詢 1: 檢查是否為擁有者]
    G --> I[子查詢 2: 檢查是否為成員]
    H --> J{無索引}
    I --> J
    J --> K[全表掃描]
    K --> L[效能瓶頸 ⚠️]
    L --> M[返回資料 2-5 秒]
    M --> N[顯示專案列表]
```

## 優化後的流程

```mermaid
graph TD
    A[使用者訪問專案列表頁面] --> B{檢查快取}
    B -->|有快取且未過期 30s| Z[直接顯示 < 100ms ⚡]
    B -->|無快取或過期| C[發送 API 請求]
    C --> D[只選取必要欄位]
    D --> E[Supabase 執行查詢]
    E --> F[套用優化後 RLS 政策]
    F --> G{使用索引查詢}
    G --> H[Index Scan on idx_projects_owner_id]
    G --> I[Index Scan on idx_project_members_user_id]
    H --> J[快速匹配]
    I --> J
    J --> K[返回資料 200-500ms ⚡]
    K --> L[存入快取]
    L --> M[顯示專案列表]
```

## 資料庫查詢優化對比

### 優化前（慢）

```mermaid
sequenceDiagram
    participant App as 前端應用
    participant SB as Supabase API
    participant DB as PostgreSQL
    participant RLS as RLS 政策
    
    App->>SB: SELECT * FROM projects
    SB->>DB: 執行查詢
    DB->>RLS: 檢查權限（第 1 列）
    RLS->>DB: is_project_accessible()
    DB->>DB: 子查詢 1: 檢查 owner_id（無索引，全表掃描）
    DB->>DB: 子查詢 2: 檢查 members（無索引，全表掃描）
    RLS-->>DB: 返回權限結果
    
    Note over DB,RLS: 對每一列重複上述步驟 ⚠️
    
    DB->>RLS: 檢查權限（第 N 列）
    RLS->>DB: is_project_accessible()
    DB->>DB: 子查詢 1 + 2...
    RLS-->>DB: 返回權限結果
    
    DB->>SB: 返回所有資料
    SB->>App: 2-5 秒後返回
```

### 優化後（快）

```mermaid
sequenceDiagram
    participant App as 前端應用
    participant Cache as React Query 快取
    participant SB as Supabase API
    participant DB as PostgreSQL
    participant RLS as RLS 政策
    
    App->>Cache: 請求專案列表
    
    alt 快取未過期（30 秒內）
        Cache-->>App: 直接返回（< 100ms）⚡
    else 快取過期或不存在
        Cache->>SB: SELECT 指定欄位 FROM projects
        SB->>DB: 執行查詢
        DB->>RLS: 檢查權限（使用優化政策）
        RLS->>DB: 使用索引快速查詢
        Note over DB: Index Scan 一次完成 ⚡
        DB->>SB: 返回必要欄位資料
        SB->>Cache: 200-500ms 後返回
        Cache->>Cache: 更新快取
        Cache-->>App: 顯示資料
    end
```

## 索引優化示意圖

### 無索引（全表掃描）

```mermaid
graph LR
    subgraph "projects 表（無索引）"
        P1[專案 1<br/>owner: A]
        P2[專案 2<br/>owner: B]
        P3[專案 3<br/>owner: A]
        P4[專案 4<br/>owner: C]
        P5[...<br/>更多專案]
    end
    
    Q[查詢: owner_id = A] -.->|掃描所有| P1
    Q -.->|掃描所有| P2
    Q -.->|掃描所有| P3
    Q -.->|掃描所有| P4
    Q -.->|掃描所有| P5
    
    style Q fill:#f99
    style P1 fill:#9f9
    style P3 fill:#9f9
```

### 有索引（Index Scan）

```mermaid
graph LR
    subgraph "idx_projects_owner_id"
        I[索引: owner_id]
        IA[A → P1, P3]
        IB[B → P2]
        IC[C → P4]
        ID[...]
    end
    
    subgraph "projects 表"
        P1[專案 1]
        P3[專案 3]
    end
    
    Q[查詢: owner_id = A] -->|直接查找| I
    I --> IA
    IA -->|只讀取匹配的| P1
    IA -->|只讀取匹配的| P3
    
    style Q fill:#9f9
    style I fill:#9f9
    style IA fill:#9f9
```

## 快取策略流程

```mermaid
stateDiagram-v2
    [*] --> 無快取
    無快取 --> 請求中: 首次訪問
    請求中 --> 快取新鮮: 請求成功
    快取新鮮 --> 快取過期: 30 秒後
    快取過期 --> 背景重新整理: 使用者再次訪問
    背景重新整理 --> 快取新鮮: 重新整理完成
    快取新鮮 --> 直接使用: 30 秒內重複訪問
    直接使用 --> 快取新鮮
    
    note right of 快取新鮮
        staleTime: 30 秒
        資料被視為新鮮
        不會重新請求
    end note
    
    note right of 快取過期
        gcTime: 5 分鐘
        快取仍保留
        但會背景更新
    end note
```

## 效能改善視覺化

```mermaid
graph LR
    subgraph "優化前"
        A1[首次載入<br/>5 秒] 
        A2[重複訪問<br/>5 秒]
        A3[切換頁面<br/>5 秒]
    end
    
    subgraph "優化後"
        B1[首次載入<br/>0.5 秒 ⚡]
        B2[重複訪問<br/>0.05 秒 ⚡⚡]
        B3[切換頁面<br/>0.05 秒 ⚡⚡]
    end
    
    A1 -.->|改善 90%| B1
    A2 -.->|改善 99%| B2
    A3 -.->|改善 99%| B3
    
    style A1 fill:#f99
    style A2 fill:#f99
    style A3 fill:#f99
    style B1 fill:#9f9
    style B2 fill:#9f9
    style B3 fill:#9f9
```

## 系統架構圖

```mermaid
graph TB
    subgraph "瀏覽器"
        UI[React UI<br/>ProjectList.tsx]
        RQ[React Query<br/>快取層]
        Hook[useProjects Hook<br/>優化查詢]
    end
    
    subgraph "Supabase"
        API[REST API]
        PG[(PostgreSQL)]
        RLS[RLS 政策<br/>已優化]
        IDX[索引<br/>已新增]
    end
    
    UI --> RQ
    RQ -->|首次/過期| Hook
    Hook -->|選取特定欄位| API
    API --> RLS
    RLS -->|使用索引| IDX
    IDX --> PG
    PG -->|快速返回| API
    API -->|200-500ms| Hook
    Hook --> RQ
    RQ -->|<100ms 快取命中| UI
    
    style RLS fill:#9f9
    style IDX fill:#9f9
    style RQ fill:#9f9
```

## 決策樹：何時需要進一步優化

```mermaid
graph TD
    Start[專案數量增長] --> Q1{專案數量}
    Q1 -->|< 50 個| A1[目前優化已足夠 ✓]
    Q1 -->|50-100 個| A2[考慮實作搜尋與篩選]
    Q1 -->|100-500 個| A3[實作分頁或無限滾動]
    Q1 -->|> 500 個| A4[實作虛擬滾動 + 分頁]
    
    A2 --> B{載入時間}
    A3 --> B
    A4 --> B
    
    B -->|< 1 秒| C1[維持現狀 ✓]
    B -->|1-3 秒| C2[優化資料庫查詢]
    B -->|> 3 秒| C3[檢查索引使用情況<br/>考慮資料庫升級]
    
    style A1 fill:#9f9
    style C1 fill:#9f9
```

---

## 補充說明

### 符號說明
- ⚡ = 效能優化點
- ⚠️ = 效能瓶頸
- ✓ = 推薦方案

### 關鍵指標
- **首次載入**：使用者首次訪問頁面的時間
- **快取命中**：使用快取資料，近乎即時
- **背景重新整理**：快取過期後在背景更新，使用者無感

### 測量工具
1. **瀏覽器 DevTools**：Network 標籤查看實際請求時間
2. **React Query DevTools**：監控快取狀態
3. **Supabase Dashboard**：Performance Insights 查看資料庫效能
