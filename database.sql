CREATE USER 'sqladmin'@'localhost' IDENTIFIED BY 'admin'; GRANT ALL PRIVILEGES ON *.* TO 'sqladmin'@'localhost' WITH GRANT OPTION; FLUSH PRIVILEGES;
CREATE DATABASE escp CHARACTER SET utf8 COLLATE utf8_general_ci;
USE escp;
DROP TABLE escp;
CREATE TABLE IF NOT EXISTS escp (
  id             int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name           varchar(64) NOT NULL,
  owner          varchar(32) NOT NULL,
  register       varchar(32) NOT NULL,
  tel            varchar(32) NOT NULL,
  address        varchar(64) NOT NULL,
  items          varchar(1024) NOT NULL,
  ipfs           varchar(128) NOT NULL,
  transaction    varchar(128) NOT NULL,
  transactionidx int,
  block          int,
  exvat          int,
  vat            int,
  total          int,
  receive        int,
  cash           int,
  card           int,
  remain         int,
  ts             timestamp NOT NULL
);
