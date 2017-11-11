set MINIKUBE_HOME=C:\Users\lucas_j\.minikube

minikube start

REM install weave scope - https://www.weave.works/docs/scope/latest/installing/#k8s
REM     kubectl apply --namespace kube-system -f "https://cloud.weave.works/k8s/scope.yaml?k8s-version=$(kubectl version | base64 | tr -d '\n')"

kubectl apply --namespace kube-system -f "https://cloud.weave.works/k8s/scope.yaml"

REM
REM expose  scope to local browser
REM kubectl port-forward -n kube-system "$(kubectl get -n kube-system pod --selector=weave-scope-component=app -o jsonpath='{.items..metadata.name}')" 4040

REM first get name of pod 
kubectl get -n kube-system pod --selector=weave-scope-component=app -o jsonpath='{.items..metadata.name}'

kubectl port-forward -n kube-system "<NAME OF POD>" 4040

kubectl port-forward -n kube-system "weave-scope-app-2977049826-66q8j" 4040


REM open in 

REM install WeaveNet - https://www.weave.works/blog/weave-net-kubernetes-integration/
kubectl apply -f https://git.io/weave-kube-1.6


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
cd TweetReceiver
kubectl create -f TweetReceiverPod.yaml  -f TweetReceiverService.yaml

cd ..
cd TweetEnricher
kubectl create -f TweetEnricherPod.yaml  -f TweetEnricherService.yaml

cd ..
cd ValidateTweet
kubectl create -f ValidateTweetPod.yaml  -f ValidateTweetService.yaml

cd ..
cd WorkflowLauncher
REM run workflow launcher locally instead of inside Kubernetes (primarily because of instability)
REM kubectl create -f WorkflowLauncherPod.yaml  
REM try to use a deployment with 3 replicas - see of that can provide availability
kubectl create -f WorkflowLauncherDeployment.yaml

cd ..
cd TweetBoard
kubectl create -f TweetBoardPod.yaml  -f TweetBoardService.yaml


cd ..

minikube ip
kubectl get pods
kubectl get services

REM now update postman - set correct minikube IP and service ports
REM through postman, set workflow template in cache
