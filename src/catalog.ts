// Generated from docs/bdl-openapi.json by scripts/generate-catalog.mjs.
import type { Endpoint } from "./shared.js";
export const endpoints: Endpoint[] = [
  {
    "path": "/aggregates/metadata",
    "label": "aggregates · Metadane",
    "parameters": []
  },
  {
    "path": "/aggregates/{id}",
    "label": "aggregates · Poziom agregacji o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "path": "/aggregates",
    "label": "aggregates · Lista poziomów agregacji",
    "parameters": [
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/attributes/metadata",
    "label": "attributes · Metadane",
    "parameters": []
  },
  {
    "path": "/attributes/{id}",
    "label": "attributes · Atrybut o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "path": "/attributes",
    "label": "attributes · Lista atrybutów",
    "parameters": [
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Display",
          "-Display",
          "Display,Id",
          "Display,-Id",
          "-Display,Id",
          "-Display,-Id",
          "Display,Id,Symbol",
          "Display,Id,-Symbol",
          "Display,-Id,Symbol",
          "Display,-Id,-Symbol",
          "-Display,Id,Symbol",
          "-Display,Id,-Symbol",
          "-Display,-Id,Symbol",
          "-Display,-Id,-Symbol",
          "Display,Symbol",
          "Display,-Symbol",
          "-Display,Symbol",
          "-Display,-Symbol",
          "Display,Symbol,Id",
          "Display,Symbol,-Id",
          "Display,-Symbol,Id",
          "Display,-Symbol,-Id",
          "-Display,Symbol,Id",
          "-Display,Symbol,-Id",
          "-Display,-Symbol,Id",
          "-Display,-Symbol,-Id",
          "Id",
          "-Id",
          "Id,Display",
          "Id,-Display",
          "-Id,Display",
          "-Id,-Display",
          "Id,Display,Symbol",
          "Id,Display,-Symbol",
          "Id,-Display,Symbol",
          "Id,-Display,-Symbol",
          "-Id,Display,Symbol",
          "-Id,Display,-Symbol",
          "-Id,-Display,Symbol",
          "-Id,-Display,-Symbol",
          "Id,Symbol",
          "Id,-Symbol",
          "-Id,Symbol",
          "-Id,-Symbol",
          "Id,Symbol,Display",
          "Id,Symbol,-Display",
          "Id,-Symbol,Display",
          "Id,-Symbol,-Display",
          "-Id,Symbol,Display",
          "-Id,Symbol,-Display",
          "-Id,-Symbol,Display",
          "-Id,-Symbol,-Display",
          "Symbol",
          "-Symbol",
          "Symbol,Display",
          "Symbol,-Display",
          "-Symbol,Display",
          "-Symbol,-Display",
          "Symbol,Display,Id",
          "Symbol,Display,-Id",
          "Symbol,-Display,Id",
          "Symbol,-Display,-Id",
          "-Symbol,Display,Id",
          "-Symbol,Display,-Id",
          "-Symbol,-Display,Id",
          "-Symbol,-Display,-Id",
          "Symbol,Id",
          "Symbol,-Id",
          "-Symbol,Id",
          "-Symbol,-Id",
          "Symbol,Id,Display",
          "Symbol,Id,-Display",
          "Symbol,-Id,Display",
          "Symbol,-Id,-Display",
          "-Symbol,Id,Display",
          "-Symbol,Id,-Display",
          "-Symbol,-Id,Display",
          "-Symbol,-Id,-Display"
        ]
      }
    ]
  },
  {
    "path": "/data/metadata",
    "label": "data · Metadane",
    "parameters": []
  },
  {
    "path": "/data/by-variable/{var-id}",
    "label": "data · Dane dla jednej zmiennej",
    "parameters": [
      {
        "name": "var-id",
        "location": "path",
        "type": "integer",
        "required": true
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "unit-parent-id",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "unit-level",
        "location": "query",
        "type": "integer",
        "required": false
      },
      {
        "name": "aggregate-id",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "1"
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      }
    ]
  },
  {
    "path": "/data/by-unit/{unit-id}",
    "label": "data · Dane dla jednej jednostki terytorialnej",
    "parameters": [
      {
        "name": "unit-id",
        "location": "path",
        "type": "string",
        "required": true
      },
      {
        "name": "var-id",
        "location": "query",
        "type": "array",
        "required": true,
        "itemType": "integer"
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "aggregate-id",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "1"
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      }
    ]
  },
  {
    "path": "/data/localities/by-variable/{var-id}",
    "label": "data · Dane dla miejscowości statystycznych dla jednej zmiennej",
    "parameters": [
      {
        "name": "var-id",
        "location": "path",
        "type": "integer",
        "required": true
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "unit-parent-id",
        "location": "query",
        "type": "string",
        "required": true
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      }
    ]
  },
  {
    "path": "/data/localities/by-unit/{unit-id}",
    "label": "data · Dane dla jednej miejscowości statystycznej",
    "parameters": [
      {
        "name": "unit-id",
        "location": "path",
        "type": "string",
        "required": true
      },
      {
        "name": "var-id",
        "location": "query",
        "type": "array",
        "required": true,
        "itemType": "integer"
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "aggregate-id",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "1"
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      }
    ]
  },
  {
    "path": "/levels/metadata",
    "label": "levels · Metadane",
    "parameters": []
  },
  {
    "path": "/levels/{id}",
    "label": "levels · Poziom obowiązywania o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "path": "/levels",
    "label": "levels · Lista poziomów obowiązywania",
    "parameters": [
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/measures/metadata",
    "label": "measures · Metadane",
    "parameters": []
  },
  {
    "path": "/measures/{id}",
    "label": "measures · Jednostka miary o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "path": "/measures",
    "label": "measures · Lista jednostek miary",
    "parameters": [
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/subjects/metadata",
    "label": "subjects · Metadane",
    "parameters": []
  },
  {
    "path": "/subjects",
    "label": "subjects · Lista tematów",
    "parameters": [
      {
        "name": "parent-id",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/subjects/search",
    "label": "subjects · Wyszukiwanie tematów wg nazwy",
    "parameters": [
      {
        "name": "name",
        "location": "query",
        "type": "string",
        "required": true
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/subjects/{id}",
    "label": "subjects · Temat o zadanym",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "string",
        "required": true
      }
    ]
  },
  {
    "path": "/units/metadata",
    "label": "units · Metadane",
    "parameters": []
  },
  {
    "path": "/units/{id}",
    "label": "units · Jednostka terytorialna (do poziomu gminy) o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "string",
        "required": true
      }
    ]
  },
  {
    "path": "/units",
    "label": "units · Lista jednostek terytorialnych",
    "parameters": [
      {
        "name": "parent-id",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "level",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "enum",
        "values": [
          "0",
          "1",
          "2",
          "3",
          "4",
          "5",
          "6"
        ]
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/units/search",
    "label": "units · Wyszukiwanie jednostek wg nazwy",
    "parameters": [
      {
        "name": "name",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "level",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "kind",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      }
    ]
  },
  {
    "path": "/units/localities",
    "label": "units · Lista miejscowości statystycznych",
    "parameters": [
      {
        "name": "parent-id",
        "location": "query",
        "type": "string",
        "required": true
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      }
    ]
  },
  {
    "path": "/units/localities/{id}",
    "label": "units · Miejscowość statystyczna o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "string",
        "required": true
      }
    ]
  },
  {
    "path": "/units/localities/search",
    "label": "units · Wyszukiwanie miejscowości statystycznych wg nazwy",
    "parameters": [
      {
        "name": "name",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,Name",
          "Id,-Name",
          "-Id,Name",
          "-Id,-Name",
          "Name",
          "-Name",
          "Name,Id",
          "Name,-Id",
          "-Name,Id",
          "-Name,-Id"
        ]
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      }
    ]
  },
  {
    "path": "/variables/metadata",
    "label": "variables · Metadane",
    "parameters": []
  },
  {
    "path": "/variables/{id}",
    "label": "variables · Zmienna o zadanym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "integer",
        "required": true
      }
    ]
  },
  {
    "path": "/variables",
    "label": "variables · Lista zmiennych",
    "parameters": [
      {
        "name": "subject-id",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "level",
        "location": "query",
        "type": "integer",
        "required": false
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,SubjectId",
          "Id,-SubjectId",
          "-Id,SubjectId",
          "-Id,-SubjectId",
          "SubjectId",
          "-SubjectId",
          "SubjectId,Id",
          "SubjectId,-Id",
          "-SubjectId,Id",
          "-SubjectId,-Id"
        ]
      }
    ]
  },
  {
    "path": "/variables/search",
    "label": "variables · Wyszukiwanie zmiennych wg warunków",
    "parameters": [
      {
        "name": "subject-id",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "name",
        "location": "query",
        "type": "string",
        "required": false
      },
      {
        "name": "level",
        "location": "query",
        "type": "integer",
        "required": false
      },
      {
        "name": "year",
        "location": "query",
        "type": "array",
        "required": false,
        "itemType": "integer"
      },
      {
        "name": "page",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "0"
      },
      {
        "name": "page-size",
        "location": "query",
        "type": "integer",
        "required": false,
        "default": "10"
      },
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id",
          "Id,SubjectId",
          "Id,-SubjectId",
          "-Id,SubjectId",
          "-Id,-SubjectId",
          "SubjectId",
          "-SubjectId",
          "SubjectId,Id",
          "SubjectId,-Id",
          "-SubjectId,Id",
          "-SubjectId,-Id"
        ]
      }
    ]
  },
  {
    "path": "/version",
    "label": "version · Wersja aplikacji",
    "parameters": []
  },
  {
    "path": "/years/metadata",
    "label": "years · Metadane",
    "parameters": []
  },
  {
    "path": "/years/{id}",
    "label": "years · Rok o wybranym Id",
    "parameters": [
      {
        "name": "id",
        "location": "path",
        "type": "string",
        "required": true
      }
    ]
  },
  {
    "path": "/years",
    "label": "years · Lista lat obowiązywania danych",
    "parameters": [
      {
        "name": "sort",
        "location": "query",
        "type": "enum",
        "required": false,
        "values": [
          "Id",
          "-Id"
        ]
      }
    ]
  }
];
