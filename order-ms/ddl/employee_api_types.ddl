create or replace 
type employee_summary_t force as object (
  id                number(10,0)
, name              varchar2(50)
, job               varchar2(50)
, votes             number(5,0)
, constructor function employee_summary_t
              ( id in number
              , name  in varchar2
              , job  in varchar2
              , votes  in number
              ) return self as result
, member function to_json
  return varchar2		  
) NOT FINAL
;
/

create or replace 
type body employee_summary_t as

constructor function employee_summary_t
             ( id in number
              , name  in varchar2
              , job  in varchar2
              , votes  in number
              ) return self as result
is
begin
  self.id:= id;
  self.name:= name;
  self.job:= job;
  self.votes:= votes;
  return;
end;

member function to_json
return varchar2
is
  l_json    varchar2(32600);
begin
  l_json:= '{'
            ||'"id" : "'||self.id||'" '
            ||', "name" : "'||self.name||'" '
            ||', "job" : "'||self.job||'" '
            ||', "votes" : "'||self.votes||'" '
            ||'}';
  return l_json;         
end to_json;

end;
/

create or replace 
type employee_list_t force as table of employee_summary_t;
/

create or replace type department_t force as object (
  id                number(10,0)
, name              varchar2(50)
, location          varchar2(50)
, salary_sum        number(10,2)
, employees_count   number(5)
)
/

create or replace type department_summary_t force as object (
  id                number(10,0)
, name              varchar2(50)
, location          varchar2(50)
)
/

create or replace 
type department_list_t force as table of department_summary_t;
/


create or replace 
type employee_t force as object (
  id                number(10,0)
, name              varchar2(50)
, job               varchar2(50)
, department_name   varchar2(50)
, department_location   varchar2(50)
, department_id     number(5,0)
, salary            number(10,2)
, commission        number(10,2)
, hiredate          date
, manager           employee_summary_t      
, staff             employee_list_t      
, constructor function employee_t
              ( id in number
              , name  in varchar2
              , job  in varchar2
              , department_name   in varchar2
              , department_location   in varchar2
              , department_id     in number
              , salary            in number
              , commission        in number
              , hiredate          in date
              , manager           in employee_summary_t      
              , staff             in employee_list_t      
              ) return self as result
, member function to_json
  return varchar2		  
, member function to_employee_summary
  return employee_summary_t		  
, static function to_json_employee_summary_list
         ( p_emp_list in employee_list_t)
  return varchar2		  
) NOT FINAL
;
/


create or replace 
type body employee_t as

constructor function employee_t
              ( id in number
              , name  in varchar2
              , job  in varchar2
              , department_name   in varchar2
              , department_location   in varchar2
              , department_id     in number
              , salary            in number
              , commission        in number
              , hiredate          in date
              , manager           in employee_summary_t      
              , staff             in employee_list_t      
              ) return self as result
is
begin
  self.id:= id;
  self.name:= name;
  self.job:= job;
  self.department_name:= department_name;
  self.department_location:= department_location;
  self.department_id:= department_id;
  self.salary:= salary;
  self.commission:= commission;
  self.hiredate:= hiredate;
  self.manager:= manager;
  self.staff:= staff;
  return;
end;

member function to_json
return varchar2
is
  l_json    varchar2(32600);
begin
  l_json:= '{'
            ||'"id" : "'||self.id||'" '
            ||', "name" : "'||self.name||'" '
            ||', "job" : "'||self.job||'" '
            ||', "department_name" : "'||self.department_name||'" '
            ||', "department_location" : "'||self.department_location||'" '
            ||', "department_id" : "'||self.department_id||'" '
            ||', "salary" : "'||self.salary||'" '
            ||', "commission" : "'||self.commission||'" '
            ||', "hiredate" : "'||to_char(self.hiredate,'YYYY-MM-DD')||'" '
            ||', "manager" : '||case when self.manager is not null then self.manager.to_json() else '{}' end
            ||', "staff" : '||employee_t.to_json_employee_summary_list(self.staff)
            ||'}';
  return l_json;         
end to_json;

member  function to_employee_summary
return employee_summary_t		  
is
begin
  return employee_summary_t(self.id, self.name, self.job, to_number(null));
end to_employee_summary;

static function to_json_employee_summary_list
       ( p_emp_list in employee_list_t)
return varchar2
is
  l_json    varchar2(32600);
  i pls_integer:= p_emp_list.first;
begin
  while (i is not null) 
  loop
    l_json:= l_json|| ',' ||p_emp_list(i).to_json;
    i:= p_emp_list.next(i);
  end loop;
  l_json:= '['||ltrim(l_json,',')||']';
  return l_json;
end to_json_employee_summary_list;	

end;
/

-- some queries that are now possible to perform

select cast
        ( multiset 
           ( select employee_summary_t(empno, ename, job)
             from   emp
            )
          as employee_list_t
        )
from dual
/        

select employee_summary_t(empno, ename, job).to_json()
from   emp
/






select employee_t( empno, ename, job
                 , (select d.dname from dept d where d.deptno = e.deptno)
                 , (select d.loc from dept d where d.deptno = e.deptno)
                 , deptno, sal, comm, hiredate
                 , (select employee_summary_t(m.empno,m.ename,m.job) 
                    from   emp m
                    where  m.empno = e.mgr
                    )
                 , cast
                   ( multiset 
                     ( select employee_summary_t(empno, ename, job)
                       from   emp s
                       where  s.mgr = e.empno
                     )
                    as employee_list_t
                   )
                 ).to_json()   
from  emp e


select employee_t( empno, ename, job
                 , (select d.dname from dept d where d.deptno = e.deptno)
                 , (select d.loc from dept d where d.deptno = e.deptno)
                 , deptno, sal, comm, hiredate
                 , (select employee_summary_t(m.empno,m.ename,m.job) 
                    from   emp m
                    where  m.empno = e.mgr
                    )
                 , cast
                   ( multiset 
                     ( select employee_summary_t(empno, ename, job)
                       from   emp s
                       where  s.mgr = e.empno
                     )
                    as employee_list_t
                   )
                 )   
from  emp e
