  pipeline {                                                
      agent any

      tools {
            nodejs 'NodeJS'
      }

      stages {
          stage('Checkout') {
              steps {
                  checkout scm
              }
          }
          stage('Install') {                                                                                                     
              steps {
                  sh 'npm ci'                                                                                                    
              }                                             
          }
          stage('Build Docker Image') {
              steps {
                  sh 'docker build -t roadmap:${BUILD_NUMBER} .'
              }
          }
            stage('Push to Docker Hub') {                                                                                                  
                steps {
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-creds',                                                                                  
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'                                                                                    
                        )]) {
                            sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                            sh 'docker tag roadmap:${BUILD_NUMBER} $DOCKER_USER/roadmap:${BUILD_NUMBER}'                                       
                            sh 'docker push $DOCKER_USER/roadmap:${BUILD_NUMBER}'                                                              
                        }                                                                                                                      
                }
            }
        }
    }