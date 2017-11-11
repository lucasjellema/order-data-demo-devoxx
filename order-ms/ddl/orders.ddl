REM AS SYS:


create user c##devoxx identified by devoxx default tablespace users temporary tablespace temp;
grant create table, create procedure , connect to c##devoxx;
ALTER USER c##devoxx QUOTA UNLIMITED ON users;
ALTER USER c##devoxx IDENTIFIED BY devoxx ACCOUNT UNLOCK;



REM as DEVOXX

create table dvx_orders
( id varchar2(200)
, status varchar2(100)
, customer_id varchar2(200)
, customer_name varchar2(200)
, shipping_destination varchar2(200)
, last_updated_timestamp timestamp default systimestamp
);



create table dvx_order_items
( order_id varchar2(200)
, product_id varchar2(200)
, product_name varchar2(200)
, quantity number(5)
, total_price number(8,2)
);

