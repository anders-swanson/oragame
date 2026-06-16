import type { Direction, QteAdvantage, QtePenalty, QtePrompt, TopicFact } from "../game/types";

const SOURCE_REPO = "https://github.com/anders-swanson/oracle-database-code-samples";
const SOURCE_BRANCH = "main";

interface PromptSeedBase {
  readonly id: string;
  readonly question: string;
  readonly snippet: string;
  readonly sourcePath: string;
  readonly timeMs?: number;
  readonly insight?: number;
  readonly advantage?: QteAdvantage;
  readonly penalty?: QtePenalty;
}

type PromptSeed =
  | (PromptSeedBase & {
      readonly mode: "sequence";
      readonly sequence: readonly Direction[];
    })
  | (PromptSeedBase & {
      readonly mode: "choice";
      readonly choices: readonly string[];
      readonly answerIndex: number;
    })
  | (PromptSeedBase & {
      readonly mode: "lane";
      readonly lanes: readonly [string, string, string];
      readonly answerIndex: number;
    });

interface TopicSeed extends Omit<TopicFact, "sourceUrl" | "prompts"> {
  readonly sourcePath: string;
  readonly prompts: readonly PromptSeed[];
}

function defaultTimeMs(mode: PromptSeed["mode"]): number {
  if (mode === "sequence") return 4300;
  if (mode === "choice") return 7200;
  return 5600;
}

function sourceUrlForPath(path: string): string {
  const route = /\.[a-z0-9]+$/i.test(path) ? "blob" : "tree";
  return `${SOURCE_REPO}/${route}/${SOURCE_BRANCH}/${path}`;
}

function buildPrompt(seed: PromptSeed): QtePrompt {
  const base = {
    id: seed.id,
    question: seed.question,
    snippet: seed.snippet,
    sourcePath: sourceUrlForPath(seed.sourcePath),
    timeMs: seed.timeMs ?? defaultTimeMs(seed.mode),
    insight: seed.insight ?? 9,
    advantage: seed.advantage ?? "double-insight",
    penalty: seed.penalty ?? "combo-loss"
  };

  if (seed.mode === "sequence") {
    return {
      ...base,
      mode: "sequence",
      sequence: seed.sequence
    };
  }

  if (seed.mode === "choice") {
    return {
      ...base,
      mode: "choice",
      choices: seed.choices,
      answerIndex: seed.answerIndex
    };
  }

  return {
    ...base,
    mode: "lane",
    lanes: seed.lanes,
    answerIndex: seed.answerIndex
  };
}

function topic(seed: TopicSeed): TopicFact {
  return {
    id: seed.id,
    label: seed.label,
    color: seed.color,
    accentColor: seed.accentColor,
    iconPath: seed.iconPath,
    pickupStyle: seed.pickupStyle,
    shortFact: seed.shortFact,
    sourceUrl: sourceUrlForPath(seed.sourcePath),
    prompts: seed.prompts.map(buildPrompt)
  };
}

const TOPIC_SEEDS: readonly TopicSeed[] = [
  {
    id: "oracle-ai-database-free",
    label: "Oracle AI DB Free",
    color: 0xff3f2f,
    accentColor: "#ff8a73",
    iconPath: "/feature-icons-glow/ai.svg",
    pickupStyle: "orb",
    sourcePath: "oracle-ai-database-docker-compose",
    shortFact:
      "Build, test, and run Oracle AI Database Free right on your workstation.",
    prompts: [
      {
        id: "free-sequence",
        mode: "sequence",
        question: "Try the local Oracle AI Database Free lab.",
        snippet: 'image: "gvenzl/oracle-free:slim-faststart"',
        sourcePath: "oracle-ai-database-docker-compose/docker-compose.yml",
        sequence: ["up", "right", "down"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "free-choice",
        mode: "choice",
        question: "What local runtime can run and test applications against Oracle AI Database Free?",
        snippet: 'new OracleContainer("gvenzl/oracle-free:slim-faststart")',
        sourcePath: "testcontainers/src/test/java/com/example/SpringBootDatabaseTest.java",
        choices: ["Testcontainers with Oracle AI Database Free", "A static browser cache", "Managed cloud services"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "vector-search",
    label: "Vector Search",
    color: 0x20c997,
    accentColor: "#20c997",
    iconPath: "/feature-icons-glow/vector-search.svg",
    pickupStyle: "orb",
    sourcePath: "ai-vector-search",
    shortFact:
      "Vector columns store embeddings in Oracle AI Database and retrieve semantically similar rows with vector distance queries (similarity search).",
    prompts: [
      {
        id: "vector-sequence",
        mode: "sequence",
        question: "Trace text into an embedding and nearest-neighbor result.",
        snippet: "VECTOR_DISTANCE(embedding, :queryVector, COSINE)",
        sourcePath: "ai-vector-search/README.md",
        sequence: ["up", "right", "right"],
        insight: 10,
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "vector-lane",
        mode: "lane",
        question: "Pick the semantic ranking signal.",
        snippet: "ORDER BY VECTOR_DISTANCE(...)",
        sourcePath: "jdbc-hybrid-search/README.md",
        lanes: ["Vector distance", "Listener age", "Wallet file"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "hybrid-indexing",
    label: "Hybrid Indexing",
    color: 0xffb000,
    accentColor: "#ffcf5c",
    iconPath: "/feature-icons-glow/json.svg",
    pickupStyle: "diamond",
    sourcePath: "jdbc-hybrid-search",
    shortFact:
      "Hybrid search combines multiple signals: vector similarity, Oracle Text, JSON metadata, and relational filters in one query path.",
    prompts: [
      {
        id: "hybrid-choice",
        mode: "choice",
        question: "Hybrid search boosts relevance by blending which signals?",
        snippet: "Oracle Text + vectors + JSON filters",
        sourcePath: "jdbc-hybrid-search/README.md",
        choices: ["Text, vector, JSON, and/or SQL in one database", "Fuzzy search", "Querying different databases"],
        answerIndex: 0
      },
      {
        id: "hybrid-lane",
        mode: "lane",
        question: "Choose the indexed JSON path.",
        snippet: "JSON_EXISTS(metadata, '$.tags?(@ == $tag)')",
        sourcePath: "jdbc-hybrid-search/src/main/resources/schema.sql",
        lanes: ["JSON path predicate", "jq bash query", "Keyboard repeat"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "json",
    label: "JSON + OSON",
    color: 0x4dabf7,
    accentColor: "#74c0fc",
    iconPath: "/feature-icons-glow/json.svg",
    pickupStyle: "chip",
    sourcePath: "json",
    shortFact:
      "Oracle document support covers JSON columns, OSON serialization, SQL/JSON operators, analytics, multivalue indexes, and more.",
    prompts: [
      {
        id: "json-sequence",
        mode: "sequence",
        question: "Insert, query, transform, then index JSON data.",
        snippet: "JSON_TRANSFORM(doc, SET '$.status' = 'READY')",
        sourcePath: "sql/json_transform.sql",
        sequence: ["down", "left", "up"],
        advantage: "clear-obstacle",
        penalty: "speed-pressure"
      },
      {
        id: "json-choice",
        mode: "choice",
        question: "Which binary JSON format is used by Oracle AI Database?",
        snippet: "OSONSerializer<WeatherEvent>",
        sourcePath: "migrate-kafka-to-oracle/kafka-app-step-2/src/main/java/com/example/kafka2/OSONSerializer.java",
        choices: ["OSON", "BSON", "Raw JSON"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "duality-views",
    label: "Duality Views",
    color: 0x5c7cfa,
    accentColor: "#91a7ff",
    iconPath: "/feature-icons-glow/duality-views.svg",
    pickupStyle: "chip",
    sourcePath: "json/jpa-duality-views",
    shortFact:
      "JSON Relational Duality Views expose document-shaped JSON while preserving normalized relational tables.",
    prompts: [
      {
        id: "duality-choice",
        mode: "choice",
        question: "Duality views let applications work with what shape over relational tables?",
        snippet: "CREATE JSON RELATIONAL DUALITY VIEW",
        sourcePath: "json/crud-duality-views/README.md",
        choices: ["JSON", "XML", "CSV"],
        answerIndex: 0
      },
      {
        id: "duality-lane",
        mode: "lane",
        question: "Pick the document update path.",
        snippet: "ETAG checks protect document writes",
        sourcePath: "json/jpa-duality-views/README.md",
        lanes: ["Duality document", "Static HTML", "Redo text only"],
        answerIndex: 0,
        advantage: "slow-time",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "property-graph",
    label: "Property Graph",
    color: 0xa78bfa,
    accentColor: "#c4b5fd",
    iconPath: "/feature-icons-glow/graph.svg",
    pickupStyle: "graph",
    sourcePath: "jdbc-property-graph",
    shortFact:
      "Oracle graphs use vertex and edge tables to define a SQL property graph, and queries paths with GRAPH_TABLE.",
    prompts: [
      {
        id: "graph-sequence",
        mode: "sequence",
        question: "Walk vertex, edge, vertex.",
        snippet: "CREATE PROPERTY GRAPH social_graph",
        sourcePath: "jdbc-property-graph/README.md",
        sequence: ["right", "up", "right"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "graph-choice",
        mode: "choice",
        question: "Which SQL table function queries graph patterns?",
        snippet: "GRAPH_TABLE(social_graph MATCH (p)-[e]->(friend))",
        sourcePath: "jdbc-property-graph/src/main/java/com/example/graph/JdbcPropertyGraphSample.java",
        choices: ["GRAPH_TABLE", "SDO_FILTER", "GRAPH_QUERY"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "graphql",
    label: "SQL GraphQL",
    color: 0xf783ac,
    accentColor: "#faa2c1",
    iconPath: "/feature-icons-glow/graphql.svg",
    pickupStyle: "diamond",
    sourcePath: "jdbc-graphql",
    shortFact:
      "Oracle SQL GraphQL syntax allows database clients to request shaped JSON from relational data.",
    prompts: [
      {
        id: "graphql-choice",
        mode: "choice",
        question: "SQL GraphQL is useful when clients need what?",
        snippet: "select data from graphql('students { ... @link(...) }')",
        sourcePath: "jdbc-graphql/src/main/java/com/example/graphql/JdbcGraphqlSample.java",
        choices: ["Shaped response JSON", "Raw column data", "XML"],
        answerIndex: 0
      },
      {
        id: "graphql-lane",
        mode: "lane",
        question: "Pick the API shape.",
        snippet: "GraphQL-style projection over Oracle tables",
        sourcePath: "jdbc-graphql/src/main/java/com/example/graphql/JdbcGraphqlSample.java",
        lanes: ["Nested query", "Message offset", "Spatial SRID"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "spatial",
    label: "Spatial",
    color: 0x15aabf,
    accentColor: "#66d9e8",
    iconPath: "/feature-icons-glow/spatial.svg",
    pickupStyle: "diamond",
    sourcePath: "jdbc-spatial-example",
    shortFact:
      "Oracle Spatial persists SDO_GEOMETRY, creates a spatial indexes, and can query geometries like windows and distances.",
    prompts: [
      {
        id: "spatial-sequence",
        mode: "sequence",
        question: "Move point to polygon window to distance result.",
        snippet: "SDO_FILTER(shape, :window) = 'TRUE'",
        sourcePath: "jdbc-spatial-example/src/main/java/com/example/spatial/JdbcSpatialExample.java",
        sequence: ["left", "left", "up"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "spatial-choice",
        mode: "choice",
        question: "Which function computes exact spatial distance?",
        snippet: "SDO_GEOM.SDO_DISTANCE(geom1, geom2, tolerance)",
        sourcePath: "jdbc-spatial-example/README.md",
        choices: ["SDO_GEOM.SDO_DISTANCE", "json_textcontains", "KafkaProducer"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "oracle-text",
    label: "Oracle Text",
    color: 0xff6b9a,
    accentColor: "#ff9fbd",
    iconPath: "/feature-icons-glow/oracle-text.svg",
    pickupStyle: "ticket",
    sourcePath: "jdbc-json-oracle-text",
    shortFact:
      "Oracle Text can build JSON search indexes and rank full-text matches with json_textcontains, SCORE, and NEAR.",
    prompts: [
      {
        id: "text-choice",
        mode: "choice",
        question: "Which operator searches indexed JSON text?",
        snippet: "json_textcontains(search_document, '$', ?, 1)",
        sourcePath: "jdbc-json-oracle-text/src/main/java/com/example/text/JdbcOracleTextSample.java",
        choices: ["json_textcontains", "SDO_WITHIN_DISTANCE", "setClientInfo"],
        answerIndex: 0
      },
      {
        id: "text-lane",
        mode: "lane",
        question: "Pick the proximity expression.",
        snippet: 'NEAR((json, search), 3)',
        sourcePath: "jdbc-json-oracle-text/README.md",
        lanes: ["NEAR", "RAW(16)", "PDB clone"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "txeventq",
    label: "TxEventQ",
    color: 0xff4d4f,
    accentColor: "#ffa8a8",
    iconPath: "/feature-icons-glow/txeventq.svg",
    pickupStyle: "queue",
    sourcePath: "txeventq-examples",
    shortFact:
      "TxEventQ enables database-backed messaging through PL/SQL, Kafka APIs, JMS, ORDS, and any database driver.",
    prompts: [
      {
        id: "txeventq-sequence",
        mode: "sequence",
        question: "Create queue, start it, then stream records.",
        snippet: "DBMS_AQADM.create_transactional_event_queue(queue_name => 'orders')",
        sourcePath: "txeventq-examples/txeventq.sql",
        sequence: ["up", "up", "right"],
        advantage: "clear-obstacle",
        penalty: "speed-pressure"
      },
      {
        id: "txeventq-lane",
        mode: "lane",
        question: "Choose the database-native REST event endpoint.",
        snippet: "/database/txeventq/clusters/{db}/topics",
        sourcePath: "txeventq-examples/ords.md",
        lanes: ["ORDS TxEventQ API", "Messaging REST", "Events System"],
        answerIndex: 0,
        advantage: "slow-time",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "okafka",
    label: "OKafka APIs",
    color: 0xe8590c,
    accentColor: "#ff922b",
    iconPath: "/feature-icons-glow/kafka.svg",
    pickupStyle: "queue",
    sourcePath: "oracle-database-kafka-apis",
    shortFact:
      "OKafka implements Kafka Java APIs over Oracle AI Database Transactional Event Queues, including transactional produce and consume flows.",
    prompts: [
      {
        id: "okafka-choice",
        mode: "choice",
        question: "Which Java client sends records into Oracle TxEventQ topics?",
        snippet: "new KafkaProducer<>(producerProps)",
        sourcePath: "oracle-database-kafka-apis/src/test/java/com/example/OKafkaExampleIT.java",
        choices: ["KafkaProducer", "OracleProducer", "JMSSender"],
        answerIndex: 0
      },
      {
        id: "okafka-sequence",
        mode: "sequence",
        question: "Begin transaction, send records, commit.",
        snippet: "producer.beginTransaction(); producer.send(record); producer.commitTransaction();",
        sourcePath: "oracle-database-kafka-apis/src/test/java/com/example/TransactionalProduceIT.java",
        sequence: ["right", "right", "down"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      }
    ]
  },
  {
    id: "jms",
    label: "JMS Messaging",
    color: 0xf06595,
    accentColor: "#faa2c1",
    iconPath: "/feature-icons-glow/jms.svg",
    pickupStyle: "queue",
    sourcePath: "jms-producer-consumer",
    shortFact:
      "JMS uses TxEventQ topics for pub/sub and queues for point-to-point delivery, including Spring Boot integration.",
    prompts: [
      {
        id: "jms-choice",
        mode: "choice",
        question: "Which Spring Boot helper publishes JMS messages to topics and queues?",
        snippet: "jmsTemplate.convertAndSend(destination, payload)",
        sourcePath: "txeventq-examples/src/main/java/com/example/txeventq/SpringJMSProducer.java",
        choices: ["JmsTemplate/JmsClient", "JdbcClient", "OracleJMS"],
        answerIndex: 0
      },
      {
        id: "jms-lane",
        mode: "lane",
        question: "Pick the pub/sub shape for Oracle AI Database Transactional Event Queues.",
        snippet: "DBMS_AQADM.JMS_TYPE",
        sourcePath: "spring-boot-jms-example/src/test/resources/init.sql",
        lanes: ["JMS topic", "Spatial index", "Duality ETAG"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "ords",
    label: "ORDS + APEX",
    color: 0x5c7cfa,
    accentColor: "#91a7ff",
    iconPath: "/feature-icons-glow/ords.svg",
    pickupStyle: "ticket",
    sourcePath: "ords-docker-compose",
    shortFact:
      "ORDS exposes Oracle AI Database over REST, MongoDB-compatible APIs, TxEventQ endpoints, and APEX-ready docker compose setup.",
    prompts: [
      {
        id: "ords-sequence",
        mode: "sequence",
        question: "Wire database, ORDS, then browser API.",
        snippet: "ORDS.ENABLE_SCHEMA",
        sourcePath: "ords-testcontainers/src/main/java/com/example/ords/OrdsContainer.java",
        sequence: ["right", "up", "left"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "ords-choice",
        mode: "choice",
        question: "Which service exposes REST and APEX paths for the database?",
        snippet: "ords-docker-compose/apex + ords_config",
        sourcePath: "ords-docker-compose/README.md",
        choices: ["Oracle REST Data Services", "TNS Listener", "Gateway REST API"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "mongodb-api",
    label: "MongoDB API",
    color: 0x2f9e44,
    accentColor: "#69db7c",
    iconPath: "/feature-icons-glow/mongodb.svg",
    pickupStyle: "chip",
    sourcePath: "spring-data-mongodb-oracle-api",
    shortFact:
      "MongoDB API is implemented with ORDS so MongoDB clients can work directly against Oracle AI Database collections.",
    prompts: [
      {
        id: "mongodb-choice",
        mode: "choice",
        question: "Which Oracle component fronts the MongoDB-compatible API?",
        snippet: "MongoClient -> ORDS -> Oracle AI Database",
        sourcePath: "spring-data-mongodb-oracle-api/README.md",
        choices: ["ORDS", "CompatAPI", "Pipeline services"],
        answerIndex: 0
      },
      {
        id: "mongodb-lane",
        mode: "lane",
        question: "Pick the document API path.",
        snippet: "spring-data-mongodb-oracle-api",
        sourcePath: "json/mongodb-duality-views/README.md",
        lanes: ["MongoDB CRUD", "Spatial buffer", "JDBC trace"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "testcontainers",
    label: "Testcontainers",
    color: 0x228be6,
    accentColor: "#74c0fc",
    iconPath: "/feature-icons-glow/testcontainers.svg",
    pickupStyle: "orb",
    sourcePath: "testcontainers",
    shortFact:
      "Java, Python, Go, TypeScript, ORDS, JSON, graph, and spatial samples all reuse disposable Oracle AI Database Free containers.",
    prompts: [
      {
        id: "testcontainers-sequence",
        mode: "sequence",
        question: "Start container, run init SQL, verify behavior.",
        snippet: 'new OracleContainer("gvenzl/oracle-free:23.26.2-full-faststart")',
        sourcePath: "testcontainers/src/test/java/com/example/InitializedDatabaseTest.java",
        sequence: ["down", "down", "right"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "testcontainers-choice",
        mode: "choice",
        question: "What makes local integration tests repeatable?",
        snippet: "withInitScript(\"schema.sql\")",
        sourcePath: "json/crud-duality-views/src/test/java/com/example/jdv/crud/JDVCrudTest.java",
        choices: ["Disposable, Free Oracle containers", "Manual screenshots", "Global browser cookies"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "spring-boot",
    label: "Spring Boot",
    color: 0x94d82d,
    accentColor: "#c0eb75",
    iconPath: "/feature-icons-glow/springboot.svg",
    pickupStyle: "chip",
    sourcePath: "spring-boot-jms-example",
    shortFact:
      "Spring Boot samples cover JMS, JDBC tracing, client info, dynamic properties, ResourceLoader, Vault, JPA, and MongoDB API access.",
    prompts: [
      {
        id: "spring-sequence",
        mode: "sequence",
        question: "Start app context, inject beans, hit Oracle.",
        snippet: "@SpringBootApplication",
        sourcePath: "spring-boot-jms-example/src/main/java/com/example/SampleApp.java",
        sequence: ["left", "up", "up"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      }
    ]
  },
  {
    id: "spring-config-resource",
    label: "Spring Config",
    color: 0x38d9a9,
    accentColor: "#63e6be",
    iconPath: "/feature-icons-glow/springboot.svg",
    pickupStyle: "chip",
    sourcePath: "spring-cloud-config",
    shortFact:
      "Spring configuration samples store config rows and resources in Oracle AI Database, then resolve them through Spring abstractions.",
    prompts: [
      {
        id: "config-choice",
        mode: "choice",
        question: "Which backend stores Spring Cloud Config values?",
        snippet: "application + profile + label + key + value",
        sourcePath: "spring-cloud-config/server/src/main/java/com/example/configserver/PropertiesController.java",
        choices: ["Oracle JDBC table", "CSS variables only", "Tilemap metadata"],
        answerIndex: 0
      },
      {
        id: "resource-lane",
        mode: "lane",
        question: "Pick the BLOB-backed resource path.",
        snippet: "EnvironmentPostProcessor adds DatabasePropertySource",
        sourcePath: "spring-boot-dynamic-property-source/src/main/java/com/example/DatabaseEnvironmentPostProcessor.java",
        lanes: ["Dynamic property", "Kafka offset", "SDO ordinate"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "observability",
    label: "Observability",
    color: 0x00b8d9,
    accentColor: "#66d9e8",
    iconPath: "/feature-icons-glow/observability.svg",
    pickupStyle: "ticket",
    sourcePath: "spring-boot-jdbc-tracing",
    shortFact:
      "Observability samples attach OpenTelemetry spans and Oracle client info so application work can be followed into database sessions.",
    prompts: [
      {
        id: "otel-choice",
        mode: "choice",
        question: "Which library wires JDBC traces into the sample?",
        snippet: "GlobalOpenTelemetry.set(openTelemetry)",
        sourcePath: "spring-boot-jdbc-tracing/src/main/java/com/example/tracing/jdbc/TracingConfigurator.java",
        choices: ["OpenTelemetry", "Oracle Text NEAR", "Phaser Loader"],
        answerIndex: 0
      },
      {
        id: "client-info-lane",
        mode: "lane",
        question: "Pick the database session breadcrumb.",
        snippet: 'conn.setClientInfo("OCSID.MODULE", "Books")',
        sourcePath: "spring-boot-database-client-info/src/main/java/com/example/clientinfo/BooksController.java",
        lanes: ["MODULE/ACTION", "viewBox", "queue shard"],
        answerIndex: 0,
        advantage: "slow-time",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "security",
    label: "Security",
    color: 0xf03e3e,
    accentColor: "#ff8787",
    iconPath: "/feature-icons-glow/security.svg",
    pickupStyle: "ticket",
    sourcePath: "jdbc-deep-data-security",
    shortFact:
      "Security samples cover Deep Data Security guardrails, OCI Vault secrets, safer configuration, and isolation boundaries.",
    prompts: [
      {
        id: "security-choice",
        mode: "choice",
        question: "Which sample keeps support-case access behind database guardrails?",
        snippet: "EndUserSecurityContext.createWithName(...).withDataRoles(...)",
        sourcePath: "jdbc-deep-data-security/src/main/java/com/example/security/OracleEndUserContextApplier.java",
        choices: ["JDBC Deep Data Security", "Only a UI card", "Static SVG icons"],
        answerIndex: 0
      },
      {
        id: "vault-lane",
        mode: "lane",
        question: "Pick the external secret source.",
        snippet: "OCI Vault -> Spring application context",
        sourcePath: "spring-vault-oracle-app/README.md",
        lanes: ["OCI Vault", "Game loop", "JSON array index"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "oci",
    label: "OCI Integration",
    color: 0xda291c,
    accentColor: "#ff9b8f",
    iconPath: "/feature-icons-glow/oci.svg",
    pickupStyle: "orb",
    sourcePath: "spring-vault-oracle-app",
    shortFact:
      "OCI-backed samples connect Oracle AI Database apps to Vault secrets and OCI Generative AI for agent workflows.",
    prompts: [
      {
        id: "oci-choice",
        mode: "choice",
        question: "Which OCI service supplies secrets to the Spring app?",
        snippet: "VaultSecretPropertySource",
        sourcePath: "spring-vault-oracle-app/README.md",
        choices: ["OCI Vault", "ORDS route cache", "Spatial metadata"],
        answerIndex: 0
      },
      {
        id: "oci-sequence",
        mode: "sequence",
        question: "Load secret, connect pool, run workload.",
        snippet: "OCI Generative AI chat + Oracle checkpoints",
        sourcePath: "python-oracle/src/python_oracle/langgraph_persistence/README.md",
        sequence: ["up", "left", "down"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      }
    ]
  },
  {
    id: "microservices-pdb",
    label: "Microservices + PDB",
    color: 0x12b886,
    accentColor: "#63e6be",
    iconPath: "/feature-icons-glow/microservices.svg",
    pickupStyle: "graph",
    sourcePath: "database-per-service-example",
    shortFact:
      "The database-per-service sample isolates student and course services with separate pluggable databases and Spring services.",
    prompts: [
      {
        id: "pdb-choice",
        mode: "choice",
        question: "What isolates each service's database ownership?",
        snippet: "students PDB + courses PDB",
        sourcePath: "database-per-service-example/README.md",
        choices: ["Pluggable databases", "One shared CSS file", "Single in-memory list"],
        answerIndex: 0
      },
      {
        id: "microservices-lane",
        mode: "lane",
        question: "Pick the service boundary.",
        snippet: "database-per-service-example/students + courses",
        sourcePath: "database-per-service-example/sample/README.md",
        lanes: ["Service PDB", "Queue offset", "JSON ETAG"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "plsql",
    label: "PL/SQL",
    color: 0xff922b,
    accentColor: "#ffc078",
    iconPath: "/feature-icons-glow/plsql.svg",
    pickupStyle: "chip",
    sourcePath: "sql",
    shortFact:
      "SQL and PL/SQL samples configure Select AI, transform JSON, and create database-side queue helpers for event processing.",
    prompts: [
      {
        id: "plsql-choice",
        mode: "choice",
        question: "Which package configures Select AI in the SQL samples?",
        snippet: "DBMS_CLOUD_AI.CREATE_PROFILE",
        sourcePath: "sql/select_ai.sql",
        choices: ["DBMS_CLOUD_AI", "JmsTemplate", "GRAPH_TABLE"],
        answerIndex: 0
      },
      {
        id: "plsql-sequence",
        mode: "sequence",
        question: "Create helper, enqueue JSON, commit.",
        snippet: "produce_json_event(payload)",
        sourcePath: "jdbc-event-streaming/README.md",
        sequence: ["down", "right", "right"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      }
    ]
  },
  {
    id: "sqlcl",
    label: "SQLcl",
    color: 0xadb5bd,
    accentColor: "#dee2e6",
    iconPath: "/feature-icons-glow/sqlcl.svg",
    pickupStyle: "ticket",
    sourcePath: "python-oracle/src/python_oracle/mcp_agent",
    shortFact:
      "SQLcl and MCP samples let agents execute natural-language database work through controlled Oracle AI Database tool calls.",
    prompts: [
      {
        id: "sqlcl-choice",
        mode: "choice",
        question: "Which command-line tool powers the Oracle AI Database MCP server?",
        snippet: "SQLcl MCP Agent",
        sourcePath: "python-oracle/src/python_oracle/mcp_agent/README.md",
        choices: ["SQLcl", "orapki", "oramcp"],
        answerIndex: 0
      },
      {
        id: "sqlcl-lane",
        mode: "lane",
        question: "Pick the agent query path.",
        snippet: "natural language -> SQLcl -> Oracle AI Database",
        sourcePath: "mcp-agent/README.md",
        lanes: ["SQLcl tool", "Sprite batch", "Static card"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "ai-agents",
    label: "AI Agents",
    color: 0x845ef7,
    accentColor: "#b197fc",
    iconPath: "/feature-icons-glow/ai.svg",
    pickupStyle: "orb",
    sourcePath: "mcp-agent",
    shortFact:
      "Agent samples combine model calls, tool routing, SQL access, durable memory, retrieval, and database-backed checkpoints.",
    prompts: [
      {
        id: "agents-choice",
        mode: "choice",
        question: "Which protocol can connect LLMs to database servers?",
        snippet: "LangChain4j MCP client -> Oracle AI Database tools",
        sourcePath: "mcp-agent/README.md",
        choices: ["MCP", "SDO_GEOMETRY", "JMS selector only"],
        answerIndex: 0
      },
      {
        id: "agents-sequence",
        mode: "sequence",
        question: "Retrieve context, call tool, persist memory.",
        snippet: "agent_memories + transcript events",
        sourcePath: "langchain4j-agent-memory/README.md",
        sequence: ["up", "left", "down"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      }
    ]
  },
  {
    id: "langchain",
    label: "LangChain",
    color: 0x51cf66,
    accentColor: "#8ce99a",
    iconPath: "/feature-icons-glow/ai.svg",
    pickupStyle: "orb",
    sourcePath: "python-oracle/src/python_oracle/langchain_retrieval",
    shortFact:
      "LangChain is used to compose Oracle vector stores, embeddings, and retrieval chains over Oracle AI Database.",
    prompts: [
      {
        id: "langchain-choice",
        mode: "choice",
        question: "Which database capability backs LangChain retrieval?",
        snippet: "OracleVS.similarity_search(...)",
        sourcePath: "python-oracle/src/python_oracle/langchain/README.md",
        choices: ["Oracle vector search", "JMS durable topic", "APEX workspace export"],
        answerIndex: 0
      },
      {
        id: "langchain-lane",
        mode: "lane",
        question: "Pick the retrieval chain signal.",
        snippet: "all-MiniLM embeddings in Oracle AI Database",
        sourcePath: "python-oracle/src/python_oracle/langchain_retrieval/README.md",
        lanes: ["Embedding match", "PDB password", "Canvas path"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "langgraph",
    label: "LangGraph",
    color: 0x9775fa,
    accentColor: "#d0bfff",
    iconPath: "/feature-icons-glow/graph.svg",
    pickupStyle: "graph",
    sourcePath: "python-oracle/src/python_oracle/langgraph_persistence",
    shortFact:
      "LangGraph persistence samples keep checkpoints and approval workflow state in Oracle AI Database for durable agent runs.",
    prompts: [
      {
        id: "langgraph-sequence",
        mode: "sequence",
        question: "Checkpoint graph state, resume, approve.",
        snippet: "Oracle checkpoint store readback",
        sourcePath: "python-oracle/src/python_oracle/langgraph_persistence/README.md",
        sequence: ["left", "down", "right"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "langgraph-choice",
        mode: "choice",
        question: "What can LangGraph persist in Oracle AI Database?",
        snippet: "checkpoints + store rows",
        sourcePath: "python-oracle/src/python_oracle/langgraph_persistence/README.md",
        choices: ["Agent workflow state", "Only CSS tokens", "Only SVG filters"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "mcp",
    label: "MCP Tools",
    color: 0x339af0,
    accentColor: "#74c0fc",
    iconPath: "/feature-icons-glow/mcp.svg",
    pickupStyle: "ticket",
    sourcePath: "mcp-agent",
    shortFact:
      "MCP samples expose database actions to agents through explicit tools, keeping natural-language workflows grounded in live Oracle data.",
    prompts: [
      {
        id: "mcp-choice",
        mode: "choice",
        question: "What does MCP provide to the database agent?",
        snippet: ".toolProvider(SQLclMCPToolProvider.create())",
        sourcePath: "mcp-agent/src/main/java/com/example/mcp/MCPAgentApplication.java",
        choices: ["Callable tools", "A tilemap parser", "Spatial SRIDs only"],
        answerIndex: 0
      },
      {
        id: "mcp-lane",
        mode: "lane",
        question: "Pick the controlled tool bridge.",
        snippet: "Model Context Protocol",
        sourcePath: "python-oracle/src/python_oracle/mcp_agent/README.md",
        lanes: ["MCP", "NEAR", "RAW(16)"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "jpa-uuid",
    label: "JPA + UUID",
    color: 0x69db7c,
    accentColor: "#b2f2bb",
    iconPath: "/feature-icons-glow/jpa.svg",
    pickupStyle: "chip",
    sourcePath: "jdbc-uuid",
    shortFact:
      "JPA and UUID samples map Java entities and identifiers to Oracle tables, including compact RAW(16) UUID storage.",
    prompts: [
      {
        id: "uuid-choice",
        mode: "choice",
        question: "How does the UUID sample store Java UUID primary keys?",
        snippet: '@Column(name = "ID", columnDefinition = "RAW(16)")',
        sourcePath: "jdbc-uuid/src/main/java/com/example/uuid/jpa/JpaOrder.java",
        choices: ["RAW(16)", "VARCHAR2(4000) only", "A queue offset"],
        answerIndex: 0
      },
      {
        id: "jpa-lane",
        mode: "lane",
        question: "Pick the repository abstraction.",
        snippet: "interface JpaOrderRepository extends JpaRepository<JpaOrder, UUID>",
        sourcePath: "jdbc-uuid/src/main/java/com/example/uuid/jpa/JpaOrderRepository.java",
        lanes: ["JpaRepository", "OracleContainer", "GRAPH_TABLE"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "client-runtimes",
    label: "Client Runtimes",
    color: 0x20c997,
    accentColor: "#63e6be",
    iconPath: "/feature-icons-glow/sqlcl.svg",
    pickupStyle: "diamond",
    sourcePath: "typescript",
    shortFact:
      "The catalog includes Java, Python, Go, TypeScript, and SQL clients, each connecting real application code to Oracle AI Database.",
    prompts: [
      {
        id: "runtime-choice",
        mode: "choice",
        question: "Which TypeScript driver appears in the Node samples?",
        snippet: "node-oracledb + TxEventQ helpers",
        sourcePath: "typescript/README.md",
        choices: ["node-oracledb", "JGeometry", "JmsTemplate"],
        answerIndex: 0
      },
      {
        id: "runtime-lane",
        mode: "lane",
        question: "Pick the Go connection helper.",
        snippet: "godror connection setup",
        sourcePath: "golang/connection/README.md",
        lanes: ["godror", "OSONSerializer", "ORDS.ENABLE_SCHEMA"],
        answerIndex: 0,
        advantage: "slow-time",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "skills",
    label: "Sample Skills",
    color: 0x748ffc,
    accentColor: "#bac8ff",
    iconPath: "/feature-icons-glow/mcp.svg",
    pickupStyle: "ticket",
    sourcePath: "skills",
    shortFact:
      "The repo includes reusable skills for building, validating, and documenting Oracle AI Database samples with repeatable workflows.",
    prompts: [
      {
        id: "skills-choice",
        mode: "choice",
        question: "Which skill targets OKafka Java sample work?",
        snippet: "skills/okafka-java-code/SKILL.md",
        sourcePath: "skills/README.md",
        choices: ["okafka-java-code", "spatial-operators.svg", "MenuScene.ts"],
        answerIndex: 0
      },
      {
        id: "skills-sequence",
        mode: "sequence",
        question: "Plan sample, implement, validate, document.",
        snippet: "oracle-code-sample-builder",
        sourcePath: "skills/README.md",
        sequence: ["right", "down", "left"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      }
    ]
  },
  {
    id: "support-ticket-intel",
    label: "Support Ticket AI",
    color: 0xffd43b,
    accentColor: "#ffe066",
    iconPath: "/feature-icons-glow/ai.svg",
    pickupStyle: "ticket",
    sourcePath: "support-ticket-intelligence",
    shortFact:
      "The support-ticket workflow combines TxEventQ, JSON, Oracle Text, vector search, property graph, duality views, Spring, and Testcontainers.",
    prompts: [
      {
        id: "ticket-sequence",
        mode: "sequence",
        question: "Route ticket through event, search, graph, and document views.",
        snippet: "producer.beginTransaction(); publishTicketOpened(); commitTransaction();",
        sourcePath: "support-ticket-intelligence/src/main/java/com/example/support/messaging/TicketEventProducer.java",
        sequence: ["left", "down", "right"],
        insight: 11,
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "ticket-choice",
        mode: "choice",
        question: "Which sample ties the most feature lanes together?",
        snippet: "vector_distance + json_textcontains + relational filters",
        sourcePath: "support-ticket-intelligence/src/main/java/com/example/support/TicketSearchService.java",
        choices: ["Support Ticket Intelligence", "Only UUID storage", "Only a Docker image"],
        answerIndex: 0
      }
    ]
  },
  {
    id: "news-event-streaming",
    label: "News Streaming",
    color: 0xff8787,
    accentColor: "#ffc9c9",
    iconPath: "/feature-icons-glow/txeventq.svg",
    pickupStyle: "queue",
    sourcePath: "news-event-streaming",
    shortFact:
      "The news sample ingests streaming events with Spring Boot, stores them in Oracle AI Database, and supports vector search over the results.",
    prompts: [
      {
        id: "news-choice",
        mode: "choice",
        question: "Which producer publishes parsed news events?",
        snippet: "KafkaProducer<String, News>",
        sourcePath: "news-event-streaming/src/main/java/com/example/news/events/factory/NewsParserConsumerProducerFactory.java",
        choices: ["OKafka producer", "SDO geometry builder", "JPA UUID mapper"],
        answerIndex: 0
      },
      {
        id: "news-lane",
        mode: "lane",
        question: "Pick the enrichment path.",
        snippet: "news events -> Oracle AI Database -> vector search",
        sourcePath: "news-event-streaming/README.md",
        lanes: ["Stream + vector", "Only SVG glow", "Only PDB clone"],
        answerIndex: 0,
        advantage: "clear-obstacle",
        penalty: "obstacle"
      }
    ]
  },
  {
    id: "sessionless-transactions",
    label: "Sessionless Tx",
    color: 0xffa94d,
    accentColor: "#ffd8a8",
    iconPath: "/feature-icons-glow/txeventq.svg",
    pickupStyle: "queue",
    sourcePath: "sessionless-transactions",
    shortFact:
      "Sessionless transaction samples show database work that can detach from a client session and complete later without pinning a connection.",
    prompts: [
      {
        id: "sessionless-sequence",
        mode: "sequence",
        question: "Start work, detach session, resume commit.",
        snippet: "conn.startTransaction(30); suspendTransactionImmediately()",
        sourcePath: "sessionless-transactions/src/main/java/com/example/txn/OrderService.java",
        sequence: ["right", "down", "right"],
        advantage: "slow-time",
        penalty: "speed-pressure"
      },
      {
        id: "sessionless-choice",
        mode: "choice",
        question: "Sessionless transactions avoid holding what?",
        snippet: "conn.resumeTransaction(gtrid)",
        sourcePath: "sessionless-transactions/src/main/java/com/example/txn/OrderService.java",
        choices: ["A persistent client session", "A JSON search index", "A graph edge table"],
        answerIndex: 0
      }
    ]
  }
];

export const ORACLE_TOPICS: readonly TopicFact[] = TOPIC_SEEDS.map(topic);

export function topicById(id: string): TopicFact {
  const topicFact = ORACLE_TOPICS.find((candidate) => candidate.id === id);

  if (!topicFact) {
    throw new Error(`Unknown Oracle topic: ${id}`);
  }

  return topicFact;
}
