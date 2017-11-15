set MINIKUBE_HOME=C:\Users\lucas_j\.minikube

minikube start

minikube ip

kubectl run redis-cache --image=redis --port=6379

kubectl expose deployment redis-cache --type=ClusterIP

cd CacheInspector
REM the deployment.yaml defines a services and a three replica deployment
kubectl apply -f CacheInspectorDeployment.yaml

REM replaced with deployment kubectl create -f CacheInspectorPod.yaml  -f CacheInspectorService.yaml

cd ..
cd LogMonitor
kubectl create -f LogMonitorPod.yaml  -f LogMonitorService.yaml


cd ..
cd CheckOrderTotal
kubectl create -f CheckOrderTotalPod.yaml  -f CheckOrderTotalService.yaml

cd ..
cd CheckShipping
kubectl create -f CheckShippingPod.yaml  -f CheckShippingService.yaml

cd ..
cd OrderArbiter
rem kubectl create -f OrderArbiterPod.yaml  -f OrderArbiterService.yaml

cd ..
cd WorkflowLauncher
REM run workflow launcher locally instead of inside Kubernetes (primarily because of instability)
REM kubectl create -f WorkflowLauncherPod.yaml  
REM try to use a deployment with 3 replicas - see of that can provide availability
rem kubectl create -f WorkflowLauncherDeployment.yaml


cd ..

minikube ip
kubectl get pods
kubectl get services

REM now update postman - set correct minikube IP and service ports
REM through postman, set workflow template in cache
