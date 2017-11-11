create or replace
package employee_api
as

function get_employees
( p_dept_id in number default null)
return employee_list_t
;

function get_employee
( p_id in number
) return employee_t
;

procedure create_employee
( p_emp in employee_t
, p_result out varchar2) 
;

procedure update_employee
( p_emp in employee_t
, p_result out varchar2) 
;


procedure delete_employee
( p_id in number
, p_result out varchar2) 
;

function get_departments
return department_list_t
;


function get_department
(p_id in number)
return department_t
;
procedure  create_department
( p_department  in department_t
, p_result out varchar2)
;


function get_presidential_votes
return sys_refcursor;

procedure vote_for_employee
( p_id in number
, p_new_vote_count out number
);

function get_vote_count_for_employee
( p_id in number
) return number;


end employee_api;
/






create or replace
package body employee_api
as


function get_vote_count_for_employee
( p_id in number
) return number
is
pragma autonomous_transaction;
  l_count number(10,0):=-1;
begin
  select count(*)
  into   l_count
  from   presidential_election
  where  empno = p_id;
  return l_count;
end get_vote_count_for_employee;  



procedure vote_for_employee
( p_id in number
, p_new_vote_count out number
) is
begin
  insert into presidential_election
  (empno, vote_timestamp)
  values
  (p_id, sysdate);
  select count(*)
  into   p_new_vote_count
  from   presidential_election
  where  empno = p_id
  ;  
end vote_for_employee;

function get_employees
( p_dept_id in number default null)
return employee_list_t
is
  l_employee_list employee_list_t;
begin
  select cast
         ( multiset 
           ( select employee_summary_t(e.empno, e.ename, e.job, (select count(*) votes from presidential_election pe where pe.empno = e.empno))
             from   emp e
             where  e.deptno = nvl(p_dept_id, e.deptno)
            )
          as employee_list_t
        )
  into l_employee_list
  from dual
  ;
  return l_employee_list;
end get_employees;  

function get_employee
( p_id in number
) return employee_t
is
  l_employee employee_t;
  l_avg_sal_in_dept number(10,2);
begin
  select employee_t( empno, ename, job
                 , (select d.dname from dept d where d.deptno = e.deptno)
                 , (select d.loc from dept d where d.deptno = e.deptno)
                 , deptno, sal, comm, hiredate
                 , (select employee_summary_t(m.empno,m.ename,m.job ,to_number(null)) 
                    from   emp m
                    where  m.empno = e.mgr
                    )
                 , cast
                   ( multiset 
                     ( select employee_summary_t(empno, ename, job ,to_number(null))
                       from   emp s
                       where  s.mgr = e.empno
                     )
                    as employee_list_t
                   )
                 )   
  into  l_employee
  from  emp e
  where e.empno = p_id
  ;
  -- additional enrichment and manipulation of employee data
  -- for example: initcap on department name and location
  l_employee.department_name:= initcap(l_employee.department_name);
  l_employee.department_location:= initcap(l_employee.department_location);
  -- or query some additional data
  select avg(sal)
  into   l_avg_sal_in_dept
  from   emp
  where  emp.deptno = (select e2.deptno from emp e2 where e2.empno = p_id)
  ;
  -- now we can use l_avg_sal_in_dept to enrich l_employee
  return l_employee;
exception
  when no_data_found
  then
    return null;
end get_employee;  

function get_presidential_votes
return sys_refcursor
is
  l_presidential_votes_c sys_refcursor;
begin  
  open l_presidential_votes_c
  for  
    select empno    id
    ,      count(*) vote_count
    ,      to_char( max(vote_timestamp),'YYYY-MM-DD HH24:MI:SS')  last_vote_timestamp
    from   presidential_election
    group
    by     empno
    order
    by     vote_count  
    ;
    return l_presidential_votes_c;
end get_presidential_votes;




procedure create_employee
( p_emp in employee_t
, p_result out varchar2) 
is 
begin
  insert into emp
  (empno, ename, deptno, job, sal, hiredate, comm, mgr)
  values
  (p_emp.id, p_emp.name, p_emp.department_id, p_emp.job, p_emp.salary, p_emp.hiredate, p_emp.commission
  , case p_emp.manager when null then null else p_emp.manager.id end);
  p_result := 'OK';
end create_employee;


procedure update_employee
( p_emp in employee_t
, p_result out varchar2) 
is 
begin
  update emp e
  set    e.ename = p_emp.name
  ,      e.job= p_emp.job
  ,      e.sal = p_emp.salary
  ,      e.comm = p_emp.commission
  ,      e.hiredate = p_emp.hiredate
  ,      e.deptno = p_emp.department_id
  ,      e.mgr = case p_emp.manager when null then null else p_emp.manager.id end
  where  e.empno = p_emp.id
  ;
  p_result := 'OK';
end update_employee;


procedure delete_employee
( p_id in number
, p_result out varchar2) 
is 
begin
  delete emp where empno = p_id;
  p_result := 'OK';
end delete_employee;


function get_departments
return department_list_t
is 
  l_department_list department_list_t;
begin
  select cast
         ( multiset 
           ( select department_summary_t(d.deptno, d.dname, d.loc)
             from   dept d
            )
          as department_list_t
        )
  into l_department_list
  from dual
  ;
  return l_department_list;
end get_departments;



function get_department
(p_id in number)
return department_t
is 
 l_dept department_t ;
begin
  select department_t( d.deptno, d.dname, d.loc
                 , (select sum(sal) from emp e where d.deptno = e.deptno)
                 , (select count(empno) from emp e where d.deptno = e.deptno)
                 )   
  into  l_dept
  from  dept d
  where d.deptno = p_id
  ;  
  return l_dept;
end get_department;

procedure  create_department
( p_department  in department_t
, p_result out varchar2)
is 
begin
  insert into dept
  (deptno, dname, loc)
  values
  ( p_department.id, p_department.name, p_department.location);
  p_result := 'OK';
end create_department;


end employee_api;








-- some queries that can now be performed:

select employee_api.get_employees
from   dual

select employee_api.get_employee( p_id => (select max(empno) from emp))
from   dual

declare
  l_vote_count number(5,0);
begin  
  employee_api.vote_for_employee
  ( p_id => 7369
  , p_new_vote_count => l_vote_count
  );
  dbms_output.put_line('New Vote Count: '|| l_vote_count);
end;

  
select employee_api.get_presidential_votes
from   dual
;

select employee_api.get_vote_count_for_employee(p_id => 7782)
from  dual
/

