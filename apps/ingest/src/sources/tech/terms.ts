/**
 * The curated IoT/embedded concept list — the editorial spine of `seed:tech-vocab`.
 *
 * WHY A CURATED LIST AND NOT A CRAWL. The obvious alternatives both fail the module's purpose:
 * NIST's glossary is 9,541 records of which 55% are acronym stubs and most of the rest is
 * compliance vocabulary (FISMA, POA&M) that no IoT engineer drills; Wikipedia's glossaries are
 * organised by academic field, not by what a working engineer meets. A hand-picked list of ~110
 * concepts an embedded/IoT developer actually uses is smaller, but every entry earns its place —
 * thin and correct beats thick and misleading, the same call v0.5 made for English grammar.
 *
 * EACH ENTRY IS (title, slug, domain):
 *  - `title` is the EXACT English Wikipedia article title — the join key to Wikidata. Generic
 *    words are pre-qualified ("Gateway (telecommunications)", "Thread (computing)") because a
 *    bare "Gateway" resolves to a disambiguation page whose QID would translate as "list of
 *    things called gateway". The seed still rejects any disambiguation page loudly; the
 *    qualification here is the first line of defence, that check is the second.
 *  - `slug` is OURS and is the stable ID key (`tech:t:iot:<slug>`). Wikipedia renames articles
 *    (I²C → I2C happened live during recon); if the ID derived from the title, a rename upstream
 *    would fork the ID and orphan SRS progress. The title is a lookup attribute; the slug is
 *    the contract.
 *  - `domain` groups the browse screen. Six values, keep them stable.
 */
export interface TechConcept {
  title: string;
  slug: string;
  domain: 'hardware' | 'electronics' | 'firmware' | 'networking' | 'security' | 'cloud';
}

const c = (title: string, slug: string, domain: TechConcept['domain']): TechConcept => ({ title, slug, domain });

export const CONCEPTS: TechConcept[] = [
  // --- hardware: boards, chips, memory, buses -----------------------------------------------
  c('Microcontroller', 'microcontroller', 'hardware'),
  c('System on a chip', 'system-on-a-chip', 'hardware'),
  c('Field-programmable gate array', 'fpga', 'hardware'),
  c('Central processing unit', 'cpu', 'hardware'),
  c('Graphics processing unit', 'gpu', 'hardware'),
  c('Printed circuit board', 'printed-circuit-board', 'hardware'),
  c('Flash memory', 'flash-memory', 'hardware'),
  c('Random-access memory', 'ram', 'hardware'),
  c('Read-only memory', 'rom', 'hardware'),
  c('EEPROM', 'eeprom', 'hardware'),
  c('CPU cache', 'cpu-cache', 'hardware'),
  c('Direct memory access', 'dma', 'hardware'),
  c('General-purpose input/output', 'gpio', 'hardware'),
  c('Serial Peripheral Interface', 'spi', 'hardware'),
  c('I2C', 'i2c', 'hardware'),
  c('Universal asynchronous receiver-transmitter', 'uart', 'hardware'),
  c('JTAG', 'jtag', 'hardware'),
  c('Watchdog timer', 'watchdog-timer', 'hardware'),
  c('Real-time clock', 'real-time-clock', 'hardware'),
  c('Raspberry Pi', 'raspberry-pi', 'hardware'),
  c('Arduino', 'arduino', 'hardware'),
  c('ESP32', 'esp32', 'hardware'),
  c('Breadboard', 'breadboard', 'hardware'),
  c('Heat sink', 'heat-sink', 'hardware'),

  // --- electronics: components and signals ---------------------------------------------------
  c('Sensor', 'sensor', 'electronics'),
  c('Actuator', 'actuator', 'electronics'),
  c('Transducer', 'transducer', 'electronics'),
  c('Accelerometer', 'accelerometer', 'electronics'),
  c('Gyroscope', 'gyroscope', 'electronics'),
  c('Thermistor', 'thermistor', 'electronics'),
  c('Relay', 'relay', 'electronics'),
  c('Capacitor', 'capacitor', 'electronics'),
  c('Resistor', 'resistor', 'electronics'),
  c('Transistor', 'transistor', 'electronics'),
  c('Diode', 'diode', 'electronics'),
  c('Light-emitting diode', 'led', 'electronics'),
  c('Crystal oscillator', 'crystal-oscillator', 'electronics'),
  c('Voltage regulator', 'voltage-regulator', 'electronics'),
  c('Analog-to-digital converter', 'adc', 'electronics'),
  c('Digital-to-analog converter', 'dac', 'electronics'),
  c('Pulse-width modulation', 'pwm', 'electronics'),
  c('Duty cycle', 'duty-cycle', 'electronics'),
  c('Voltage', 'voltage', 'electronics'),
  c('Electric current', 'electric-current', 'electronics'),
  c("Ohm's law", 'ohms-law', 'electronics'),
  c('Alternating current', 'alternating-current', 'electronics'),
  c('Direct current', 'direct-current', 'electronics'),
  c('Ground (electricity)', 'electrical-ground', 'electronics'),
  c('Short circuit', 'short-circuit', 'electronics'),
  c('Electromagnetic interference', 'emi', 'electronics'),
  c('Multimeter', 'multimeter', 'electronics'),
  c('Oscilloscope', 'oscilloscope', 'electronics'),

  // --- firmware & software -------------------------------------------------------------------
  c('Firmware', 'firmware', 'firmware'),
  c('Embedded system', 'embedded-system', 'firmware'),
  c('Real-time operating system', 'rtos', 'firmware'),
  c('Bootloader', 'bootloader', 'firmware'),
  c('Booting', 'booting', 'firmware'),
  c('Device driver', 'device-driver', 'firmware'),
  c('Interrupt', 'interrupt', 'firmware'),
  c('Thread (computing)', 'thread', 'firmware'),
  c('Process (computing)', 'process', 'firmware'),
  c('Scheduling (computing)', 'scheduling', 'firmware'),
  c('Finite-state machine', 'finite-state-machine', 'firmware'),
  c('Compiler', 'compiler', 'firmware'),
  c('Cross compiler', 'cross-compiler', 'firmware'),
  c('Toolchain', 'toolchain', 'firmware'),
  c('Debugging', 'debugging', 'firmware'),
  c('Debugger', 'debugger', 'firmware'),
  c('Emulator', 'emulator', 'firmware'),
  c('Memory leak', 'memory-leak', 'firmware'),
  c('Buffer overflow', 'buffer-overflow', 'firmware'),
  c('Unit testing', 'unit-testing', 'firmware'),
  c('Application programming interface', 'api', 'firmware'),
  c('Software development kit', 'sdk', 'firmware'),
  c('Integrated development environment', 'ide', 'firmware'),
  c('Operating system', 'operating-system', 'firmware'),
  c('Linux', 'linux', 'firmware'),
  c('Version control', 'version-control', 'firmware'),
  c('Git', 'git', 'firmware'),
  c('Continuous integration', 'continuous-integration', 'firmware'),
  c('Over-the-air update', 'ota-update', 'firmware'),

  // --- networking & protocols ----------------------------------------------------------------
  c('Internet of things', 'internet-of-things', 'networking'),
  c('MQTT', 'mqtt', 'networking'),
  c('Constrained Application Protocol', 'coap', 'networking'),
  c('HTTP', 'http', 'networking'),
  c('Transmission Control Protocol', 'tcp', 'networking'),
  c('User Datagram Protocol', 'udp', 'networking'),
  c('Internet Protocol', 'internet-protocol', 'networking'),
  c('IPv6', 'ipv6', 'networking'),
  c('6LoWPAN', '6lowpan', 'networking'),
  c('Zigbee', 'zigbee', 'networking'),
  c('Z-Wave', 'z-wave', 'networking'),
  c('LoRa', 'lora', 'networking'),
  c('Bluetooth', 'bluetooth', 'networking'),
  c('Bluetooth Low Energy', 'bluetooth-low-energy', 'networking'),
  c('Wi-Fi', 'wi-fi', 'networking'),
  c('Ethernet', 'ethernet', 'networking'),
  c('Modbus', 'modbus', 'networking'),
  c('CAN bus', 'can-bus', 'networking'),
  c('Gateway (telecommunications)', 'gateway', 'networking'),
  c('Router (computing)', 'router', 'networking'),
  c('Network switch', 'network-switch', 'networking'),
  c('Wireless access point', 'access-point', 'networking'),
  c('Domain Name System', 'dns', 'networking'),
  c('Dynamic Host Configuration Protocol', 'dhcp', 'networking'),
  c('Network address translation', 'nat', 'networking'),
  c('Mesh networking', 'mesh-networking', 'networking'),
  c('Telemetry', 'telemetry', 'networking'),
  c('Near-field communication', 'nfc', 'networking'),
  c('Radio-frequency identification', 'rfid', 'networking'),
  c('Antenna (radio)', 'antenna', 'networking'),
  c('Bandwidth (computing)', 'bandwidth', 'networking'),
  c('Latency (engineering)', 'latency', 'networking'),
  c('Throughput', 'throughput', 'networking'),
  c('Quality of service', 'quality-of-service', 'networking'),
  c('Power over Ethernet', 'poe', 'networking'),

  // --- security ------------------------------------------------------------------------------
  c('Encryption', 'encryption', 'security'),
  c('Public-key cryptography', 'public-key-cryptography', 'security'),
  c('Transport Layer Security', 'tls', 'security'),
  c('Authentication', 'authentication', 'security'),
  c('Authorization', 'authorization', 'security'),
  c('Public key certificate', 'certificate', 'security'),
  c('Certificate authority', 'certificate-authority', 'security'),
  c('Digital signature', 'digital-signature', 'security'),
  c('Cryptographic hash function', 'hash-function', 'security'),
  c('Access control', 'access-control', 'security'),
  c('Multi-factor authentication', 'mfa', 'security'),
  c('Firewall (computing)', 'firewall', 'security'),
  c('Virtual private network', 'vpn', 'security'),
  c('Malware', 'malware', 'security'),
  c('Phishing', 'phishing', 'security'),
  c('Denial-of-service attack', 'dos-attack', 'security'),
  c('Botnet', 'botnet', 'security'),
  c('Vulnerability (computer security)', 'vulnerability', 'security'),
  c('Penetration test', 'penetration-test', 'security'),
  c('Hardware security module', 'hsm', 'security'),

  // --- cloud & data --------------------------------------------------------------------------
  c('Cloud computing', 'cloud-computing', 'cloud'),
  c('Edge computing', 'edge-computing', 'cloud'),
  c('Server (computing)', 'server', 'cloud'),
  c('Virtual machine', 'virtual-machine', 'cloud'),
  c('Docker (software)', 'docker', 'cloud'),
  c('Kubernetes', 'kubernetes', 'cloud'),
  c('DevOps', 'devops', 'cloud'),
  c('Database', 'database', 'cloud'),
  c('SQL', 'sql', 'cloud'),
  c('Time series database', 'time-series-database', 'cloud'),
  c('Message queue', 'message-queue', 'cloud'),
  c('Publish–subscribe pattern', 'pub-sub', 'cloud'),
  c('Load balancing (computing)', 'load-balancing', 'cloud'),
  c('Microservices', 'microservices', 'cloud'),
  c('REST', 'rest', 'cloud'),
  c('WebSocket', 'websocket', 'cloud'),
  c('JSON', 'json', 'cloud'),
  c('Data logger', 'data-logger', 'cloud'),
  c('Big data', 'big-data', 'cloud'),
  c('Machine learning', 'machine-learning', 'cloud'),
  c('Artificial intelligence', 'artificial-intelligence', 'cloud'),
  c('Digital twin', 'digital-twin', 'cloud'),
  c('Scalability', 'scalability', 'cloud'),
  c('Failover', 'failover', 'cloud'),
  c('Backup', 'backup', 'cloud'),
];
