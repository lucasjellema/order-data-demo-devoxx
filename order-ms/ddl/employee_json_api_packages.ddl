create or replace
package employee_json_api
as

function get_employees_json
return varchar2
;

function get_employee_json
( p_id in number
) return varchar2
;

end employee_json_api;
/
    create or replace
    package body employee_json_api
    as

    function get_employees_json
    return varchar2
    is
      l_json varchar2(32000);
    begin
    l_json:= employee_t.to_json_employee_summary_list(employee_api.get_employees);
    return l_json;
    exception
      when others
      then
        return '{"error":"'||SQLERRM||'"}';
    end get_employees_json;  

    function get_employee_json
    ( p_id in number
    ) return varchar2
    is
      l_employee employee_t;
    begin
      l_employee:=employee_api.get_employee(p_id => p_id);
      if l_employee is not null
      then 
        return l_employee.to_json();
      else 
        return '{}';
      end if;
    end get_employee_json;  

    end employee_json_api;
    /


-- some queries that can now be performed:

select employee_json_api.get_employees_json
from   dual


select employee_json_api.get_employee_json( p_id => (select max(empno) from emp))
from   dual